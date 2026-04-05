/**
 * TapiBridge.cs
 *
 * Standalone Windows console application that bridges TAPI 2.0 events to the
 * Node.js backend via a local WebSocket server.
 *
 * Usage:
 *   TapiBridge.exe [--port 8765] [--device 0]
 *
 * Protocol (JSON over WebSocket):
 *
 *   Bridge → Node (events):
 *     { "type": "READY" }
 *     { "type": "OFFERING",     "callId": 1, "phone": "01151234567" }
 *     { "type": "CONNECTED",    "callId": 1 }
 *     { "type": "DISCONNECTED", "callId": 1, "durationSeconds": 42 }
 *     { "type": "ERROR",        "message": "..." }
 *
 *   Node → Bridge (commands):
 *     { "type": "DIAL", "phone": "01151234567" }
 *
 * Requirements:
 *   - Windows with TAPI 2.0 (tapi32.dll)
 *   - BT Go TAPI service provider installed and active
 */

using System.Net;
using System.Net.WebSockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace TapiBridge;

// ---------------------------------------------------------------------------
// TAPI P/Invoke declarations
// ---------------------------------------------------------------------------

[StructLayout(LayoutKind.Sequential)]
internal struct LINEINITIALIZEEXPARAMS
{
    public uint dwTotalSize;
    public uint dwNeededSize;
    public uint dwUsedSize;
    public uint dwOptions;
    public IntPtr hEvent;           // union: hEvent | hCompletionPort
    public uint dwCompletionKey;
}

[StructLayout(LayoutKind.Sequential)]
internal struct LINEEXTENSIONID
{
    public uint dwExtensionID0;
    public uint dwExtensionID1;
    public uint dwExtensionID2;
    public uint dwExtensionID3;
}

// Delegate type for the TAPI message callback.
// TAPI calls this from its own internal thread.
internal delegate void LINECALLBACK(
    int dwDevice,
    int dwMsg,
    IntPtr dwCallbackInstance,
    IntPtr dwParam1,
    IntPtr dwParam2,
    IntPtr dwParam3);

internal static class Tapi
{
    // TAPI message types
    public const int LINE_CALLSTATE = 5;

    // LINECALLSTATE flags
    public const uint LINECALLSTATE_OFFERING      = 0x00000002;
    public const uint LINECALLSTATE_CONNECTED     = 0x00000100;
    public const uint LINECALLSTATE_DISCONNECTED  = 0x00004000;

    // lineOpen dwPrivileges
    public const int LINEOPENMODE_OWNER   = 0x00000008;
    public const int LINEOPENMODE_MONITOR = 0x00080000;

    // lineOpen dwMediaModes
    public const int LINEMEDIAMODE_INTERACTIVEVOICE = 0x00000008;

    // LINEINITIALIZEEXOPTION
    public const uint LINEINITIALIZEEXOPTION_USEHIDDENAPPLICATION = 0x00000001;

    // LINECALLPARTYID flags — indicates CallerID is available as a string
    public const uint LINECALLPARTYID_ADDRESS = 0x00000002;

    // Fixed byte offsets within LINECALLINFO for CallerID fields
    // (calculated from TAPI 2.1 SDK struct definition)
    public const int CALLINFO_CALLERID_FLAGS_OFFSET  = 108;
    public const int CALLINFO_CALLERID_SIZE_OFFSET   = 112;
    public const int CALLINFO_CALLERID_OFFSET_OFFSET = 116;

    // Initial LINECALLINFO buffer size — TAPI fills in dwNeededSize if too small
    public const int CALLINFO_INITIAL_BUFFER = 512;

    [DllImport("tapi32.dll", CharSet = CharSet.Unicode, SetLastError = false)]
    public static extern int lineInitializeEx(
        out IntPtr lphLineApp,
        IntPtr hInstance,
        LINECALLBACK lpfnCallback,
        string lpszFriendlyAppName,
        out int lpdwNumDevs,
        ref int lpdwAPIVersion,
        ref LINEINITIALIZEEXPARAMS lpLineInitializeExParams);

    [DllImport("tapi32.dll", CharSet = CharSet.Unicode, SetLastError = false)]
    public static extern int lineNegotiateAPIVersion(
        IntPtr hLineApp,
        int dwDeviceID,
        int dwAPILowVersion,
        int dwAPIHighVersion,
        out int lpdwAPIVersion,
        out LINEEXTENSIONID lpExtensionID);

    [DllImport("tapi32.dll", CharSet = CharSet.Unicode, SetLastError = false)]
    public static extern int lineOpen(
        IntPtr hLineApp,
        int dwDeviceID,
        out IntPtr lphLine,
        int dwAPIVersion,
        int dwExtVersion,
        IntPtr dwCallbackInstance,
        int dwPrivileges,
        int dwMediaModes,
        IntPtr lpCallParams);

    [DllImport("tapi32.dll", CharSet = CharSet.Unicode, SetLastError = false)]
    public static extern int lineGetCallInfo(IntPtr hCall, IntPtr lpCallInfo);

    [DllImport("tapi32.dll", CharSet = CharSet.Unicode, SetLastError = false)]
    public static extern int lineMakeCall(
        IntPtr hLine,
        out IntPtr lphCall,
        string lpszDestAddress,
        int dwCountryCode,
        IntPtr lpCallParams);

    [DllImport("tapi32.dll", CharSet = CharSet.Unicode, SetLastError = false)]
    public static extern int lineDeallocateCall(IntPtr hCall);

    [DllImport("tapi32.dll", CharSet = CharSet.Unicode, SetLastError = false)]
    public static extern int lineClose(IntPtr hLine);

    [DllImport("tapi32.dll", CharSet = CharSet.Unicode, SetLastError = false)]
    public static extern int lineShutdown(IntPtr hLineApp);
}

// ---------------------------------------------------------------------------
// Active call tracker
// ---------------------------------------------------------------------------

internal record ActiveCall(IntPtr Handle, DateTime StartedAt, string? Phone);

// ---------------------------------------------------------------------------
// WebSocket client manager
// ---------------------------------------------------------------------------

internal sealed class WsClientManager : IDisposable
{
    private readonly List<WebSocket> _clients = [];
    private readonly Lock _lock = new();

    public void Add(WebSocket ws)
    {
        lock (_lock) _clients.Add(ws);
    }

    public void Remove(WebSocket ws)
    {
        lock (_lock) _clients.Remove(ws);
    }

    public async Task BroadcastAsync(string json, CancellationToken ct)
    {
        var bytes = Encoding.UTF8.GetBytes(json);
        var segment = new ArraySegment<byte>(bytes);

        WebSocket[] snapshot;
        lock (_lock) snapshot = [.. _clients];

        foreach (var ws in snapshot)
        {
            if (ws.State == WebSocketState.Open)
            {
                try { await ws.SendAsync(segment, WebSocketMessageType.Text, true, ct); }
                catch { /* client disconnected — Remove() is called by the receive loop */ }
            }
        }
    }

    public void Dispose()
    {
        lock (_lock)
        {
            foreach (var ws in _clients)
                ws.Dispose();
            _clients.Clear();
        }
    }
}

// ---------------------------------------------------------------------------
// Main bridge
// ---------------------------------------------------------------------------

internal sealed class Bridge : IDisposable
{
    private readonly int _port;
    private readonly int _deviceId;

    private IntPtr _hLineApp;
    private IntPtr _hLine;
    private int _negotiatedApiVersion;

    // Keep the delegate alive for the duration of the process (GC guard)
    private readonly LINECALLBACK _tapiCallback;

    private readonly WsClientManager _wsClients = new();
    private readonly Dictionary<IntPtr, ActiveCall> _activeCalls = [];
    private readonly Lock _callsLock = new();

    private readonly CancellationTokenSource _cts = new();

    public Bridge(int port, int deviceId)
    {
        _port = port;
        _deviceId = deviceId;
        _tapiCallback = OnTapiMessage; // pin the delegate
    }

    // ------------------------------------------------------------------
    // Entry point
    // ------------------------------------------------------------------

    public async Task RunAsync()
    {
        Console.CancelKeyPress += (_, e) =>
        {
            e.Cancel = true;
            _cts.Cancel();
        };

        Log("INFO", $"Starting TAPI bridge on ws://127.0.0.1:{_port}");

        InitTapi();

        var httpListener = new HttpListener();
        httpListener.Prefixes.Add($"http://127.0.0.1:{_port}/");
        httpListener.Start();

        Log("INFO", $"WebSocket server listening on port {_port}");

        // Accept WebSocket connections until cancelled
        while (!_cts.Token.IsCancellationRequested)
        {
            HttpListenerContext ctx;
            try
            {
                ctx = await httpListener.GetContextAsync().WaitAsync(_cts.Token);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            if (ctx.Request.IsWebSocketRequest)
            {
                _ = HandleClientAsync(ctx);
            }
            else
            {
                ctx.Response.StatusCode = 426;
                ctx.Response.Close();
            }
        }

        httpListener.Stop();
        Log("INFO", "TAPI bridge shut down");
    }

    // ------------------------------------------------------------------
    // WebSocket client handler
    // ------------------------------------------------------------------

    private async Task HandleClientAsync(HttpListenerContext ctx)
    {
        var wsCtx = await ctx.AcceptWebSocketAsync(null);
        var ws = wsCtx.WebSocket;
        _wsClients.Add(ws);

        Log("INFO", "Node.js client connected");

        // Send READY so Node knows the bridge is up
        await SendAsync(ws, new { type = "READY" });

        var buffer = new byte[4096];
        try
        {
            while (ws.State == WebSocketState.Open && !_cts.Token.IsCancellationRequested)
            {
                var result = await ws.ReceiveAsync(buffer, _cts.Token);

                if (result.MessageType == WebSocketMessageType.Close)
                    break;

                if (result.MessageType == WebSocketMessageType.Text)
                {
                    var json = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    HandleCommand(json);
                }
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            Log("WARN", $"Client connection error: {ex.Message}");
        }
        finally
        {
            _wsClients.Remove(ws);
            if (ws.State == WebSocketState.Open)
                await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None);
            ws.Dispose();
            Log("INFO", "Node.js client disconnected");
        }
    }

    // ------------------------------------------------------------------
    // Commands from Node.js
    // ------------------------------------------------------------------

    private void HandleCommand(string json)
    {
        try
        {
            var node = JsonNode.Parse(json);
            if (node is null) return;

            var type = node["type"]?.GetValue<string>();
            if (type == "DIAL")
            {
                var phone = node["phone"]?.GetValue<string>();
                if (!string.IsNullOrWhiteSpace(phone))
                    Dial(phone);
            }
        }
        catch (Exception ex)
        {
            Log("WARN", $"Failed to parse command: {ex.Message}");
        }
    }

    // ------------------------------------------------------------------
    // TAPI initialisation
    // ------------------------------------------------------------------

    private void InitTapi()
    {
        var initParams = new LINEINITIALIZEEXPARAMS
        {
            dwTotalSize = (uint)Marshal.SizeOf<LINEINITIALIZEEXPARAMS>(),
            dwOptions = Tapi.LINEINITIALIZEEXOPTION_USEHIDDENAPPLICATION,
        };

        int apiVersion = 0x00020001; // TAPI 2.1
        int numDevs;

        int hr = Tapi.lineInitializeEx(
            out _hLineApp,
            IntPtr.Zero,
            _tapiCallback,
            "TapiBridge",
            out numDevs,
            ref apiVersion,
            ref initParams);

        if (hr != 0)
            throw new InvalidOperationException($"lineInitializeEx failed: 0x{hr:X8}. Is the TAPI service provider installed?");

        Log("INFO", $"TAPI initialised. {numDevs} line device(s) found.");

        if (numDevs == 0)
            throw new InvalidOperationException("No TAPI line devices found. Is Go TAPI installed and configured?");

        if (_deviceId >= numDevs)
            throw new InvalidOperationException($"Device ID {_deviceId} out of range (0–{numDevs - 1}).");

        // Negotiate API version for our target device
        hr = Tapi.lineNegotiateAPIVersion(
            _hLineApp,
            _deviceId,
            0x00020000,  // min: TAPI 2.0
            0x00020001,  // max: TAPI 2.1
            out _negotiatedApiVersion,
            out _);

        if (hr != 0)
            throw new InvalidOperationException($"lineNegotiateAPIVersion failed: 0x{hr:X8}");

        Log("INFO", $"Negotiated TAPI API version: 0x{_negotiatedApiVersion:X8}");

        // Open the line to both monitor and make calls
        hr = Tapi.lineOpen(
            _hLineApp,
            _deviceId,
            out _hLine,
            _negotiatedApiVersion,
            0,
            IntPtr.Zero,
            Tapi.LINEOPENMODE_OWNER | Tapi.LINEOPENMODE_MONITOR,
            Tapi.LINEMEDIAMODE_INTERACTIVEVOICE,
            IntPtr.Zero);

        if (hr != 0)
            throw new InvalidOperationException($"lineOpen failed: 0x{hr:X8}");

        Log("INFO", $"TAPI line {_deviceId} opened successfully");
    }

    // ------------------------------------------------------------------
    // TAPI callback (called on a TAPI-internal thread)
    // ------------------------------------------------------------------

    private void OnTapiMessage(
        int dwDevice,
        int dwMsg,
        IntPtr dwCallbackInstance,
        IntPtr dwParam1,
        IntPtr dwParam2,
        IntPtr dwParam3)
    {
        if (dwMsg != Tapi.LINE_CALLSTATE) return;

        var hCall = (IntPtr)dwDevice;
        var callState = (uint)dwParam1.ToInt64();

        switch (callState)
        {
            case Tapi.LINECALLSTATE_OFFERING:
                HandleOffering(hCall);
                break;

            case Tapi.LINECALLSTATE_CONNECTED:
                HandleConnected(hCall);
                break;

            case Tapi.LINECALLSTATE_DISCONNECTED:
                HandleDisconnected(hCall);
                break;
        }
    }

    // ------------------------------------------------------------------
    // Call state handlers
    // ------------------------------------------------------------------

    private void HandleOffering(IntPtr hCall)
    {
        var phone = GetCallerNumber(hCall);
        Log("INFO", $"OFFERING — caller: {phone ?? "(unknown)"}");

        ActiveCall call;
        lock (_callsLock)
        {
            call = new ActiveCall(hCall, DateTime.UtcNow, phone);
            _activeCalls[hCall] = call;
        }

        var payload = JsonSerializer.Serialize(new
        {
            type = "OFFERING",
            callId = hCall.ToInt64(),
            phone = call.Phone ?? string.Empty,
        });

        _ = _wsClients.BroadcastAsync(payload, _cts.Token);
    }

    private void HandleConnected(IntPtr hCall)
    {
        Log("INFO", $"CONNECTED — hCall=0x{hCall:X}");

        var payload = JsonSerializer.Serialize(new
        {
            type = "CONNECTED",
            callId = hCall.ToInt64(),
        });

        _ = _wsClients.BroadcastAsync(payload, _cts.Token);
    }

    private void HandleDisconnected(IntPtr hCall)
    {
        ActiveCall? call;
        lock (_callsLock)
        {
            _activeCalls.TryGetValue(hCall, out call);
            _activeCalls.Remove(hCall);
        }

        var duration = call is not null
            ? (int)(DateTime.UtcNow - call.StartedAt).TotalSeconds
            : 0;

        Log("INFO", $"DISCONNECTED — hCall=0x{hCall:X}, duration={duration}s");

        var payload = JsonSerializer.Serialize(new
        {
            type = "DISCONNECTED",
            callId = hCall.ToInt64(),
            phone = call?.Phone ?? string.Empty,
            durationSeconds = duration,
        });

        _ = _wsClients.BroadcastAsync(payload, _cts.Token);

        Tapi.lineDeallocateCall(hCall);
    }

    // ------------------------------------------------------------------
    // Click-to-dial
    // ------------------------------------------------------------------

    private void Dial(string phone)
    {
        Log("INFO", $"Dialling {phone}");

        int hr = Tapi.lineMakeCall(_hLine, out var hCall, phone, 0, IntPtr.Zero);
        if (hr != 0 && hr != 1) // 1 = async success (LINEERR_REQUESTPROCEEDED)
        {
            Log("WARN", $"lineMakeCall failed: 0x{hr:X8}");

            var errPayload = JsonSerializer.Serialize(new
            {
                type = "ERROR",
                message = $"lineMakeCall failed: 0x{hr:X8}",
            });
            _ = _wsClients.BroadcastAsync(errPayload, _cts.Token);
        }
    }

    // ------------------------------------------------------------------
    // Extract caller number from LINECALLINFO
    // ------------------------------------------------------------------

    private string? GetCallerNumber(IntPtr hCall)
    {
        // Allocate an initial buffer; TAPI fills dwNeededSize if it needs more.
        IntPtr buf = Marshal.AllocHGlobal(Tapi.CALLINFO_INITIAL_BUFFER);
        try
        {
            Marshal.WriteInt32(buf, Tapi.CALLINFO_INITIAL_BUFFER); // dwTotalSize
            int hr = Tapi.lineGetCallInfo(hCall, buf);

            if (hr != 0)
            {
                Log("WARN", $"lineGetCallInfo failed: 0x{hr:X8}");
                return null;
            }

            // Check if we need a bigger buffer
            int neededSize = Marshal.ReadInt32(buf, 4); // dwNeededSize @ offset 4
            if (neededSize > Tapi.CALLINFO_INITIAL_BUFFER)
            {
                Marshal.FreeHGlobal(buf);
                buf = Marshal.AllocHGlobal(neededSize);
                Marshal.WriteInt32(buf, neededSize);
                hr = Tapi.lineGetCallInfo(hCall, buf);
                if (hr != 0) return null;
            }

            // Read CallerID fields
            uint callerIdFlags  = (uint)Marshal.ReadInt32(buf, Tapi.CALLINFO_CALLERID_FLAGS_OFFSET);
            int  callerIdSize   = Marshal.ReadInt32(buf, Tapi.CALLINFO_CALLERID_SIZE_OFFSET);
            int  callerIdOffset = Marshal.ReadInt32(buf, Tapi.CALLINFO_CALLERID_OFFSET_OFFSET);

            if ((callerIdFlags & Tapi.LINECALLPARTYID_ADDRESS) == 0 || callerIdSize <= 0)
                return null;

            // The CallerID string is Unicode, stored at callerIdOffset from the start of the buffer
            string raw = Marshal.PtrToStringUni(buf + callerIdOffset, callerIdSize / 2).TrimEnd('\0');
            return string.IsNullOrWhiteSpace(raw) ? null : raw;
        }
        finally
        {
            Marshal.FreeHGlobal(buf);
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private static async Task SendAsync(WebSocket ws, object payload)
    {
        var json = JsonSerializer.Serialize(payload);
        var bytes = Encoding.UTF8.GetBytes(json);
        await ws.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
    }

    private static void Log(string level, string message)
    {
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [{level}] {message}");
    }

    // ------------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------------

    public void Dispose()
    {
        _cts.Cancel();
        _wsClients.Dispose();

        if (_hLine != IntPtr.Zero)
        {
            Tapi.lineClose(_hLine);
            _hLine = IntPtr.Zero;
        }

        if (_hLineApp != IntPtr.Zero)
        {
            Tapi.lineShutdown(_hLineApp);
            _hLineApp = IntPtr.Zero;
        }

        _cts.Dispose();
    }
}

// ---------------------------------------------------------------------------
// Program entry point
// ---------------------------------------------------------------------------

internal static class Program
{
    static async Task<int> Main(string[] args)
    {
        int port = 8765;
        int device = 0;

        for (int i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == "--port" && int.TryParse(args[i + 1], out var p)) port = p;
            if (args[i] == "--device" && int.TryParse(args[i + 1], out var d)) device = d;
        }

        using var bridge = new Bridge(port, device);
        try
        {
            await bridge.RunAsync();
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[FATAL] {ex.Message}");
            return 1;
        }
    }
}
