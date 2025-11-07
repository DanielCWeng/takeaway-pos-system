// client/src/components/DeliveryAddressModal.tsx (Complete, with Town and Distance)

import React, { useState, useEffect, useRef } from "react";
import { CustomerInfo } from "../types"; // Adjusted path assuming types.ts is in src/
import postcodeData from "../postcodes_detailed.json";

// --- Helper Components (Unchanged) ---
const PosButton = ({
  children,
  className = "",
  ...props
}: {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}) => (
  <button
    className={`px-2 py-1 bg-gray-300 border-2 border-r-gray-500 border-b-gray-500 border-l-gray-100 border-t-gray-100 active:border-l-gray-500 active:border-t-gray-500 active:border-r-gray-100 active:border-b-gray-100 focus:outline-none disabled:text-gray-500 disabled:opacity-70 ${className}`}
    {...props}
  >
    {children}
  </button>
);
const InputField = React.forwardRef<HTMLInputElement, any>(
  (
    { label, value, onFocus, onChange, onClear, className, readOnly = false },
    ref
  ) => (
    <div className={`flex items-center ${className}`}>
      <label className="w-24 text-right pr-2">{label}</label>
      <div className="flex-grow relative flex items-center">
        <input
          ref={ref}
          type="text"
          value={value}
          onFocus={onFocus}
          onChange={onChange}
          readOnly={readOnly}
          className="w-full bg-white border border-gray-400 px-1 h-7 disabled:bg-gray-200"
          disabled={readOnly}
        />
        {!readOnly && value && (
          <button
            onClick={onClear}
            className="absolute right-1 w-5 h-5 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs font-mono hover:bg-red-500"
          >
            X
          </button>
        )}
      </div>
    </div>
  )
);
const keyboardLayout = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "Exit"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "<- BS"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Enter"],
  ["Tab", "/", "Z", "X", "C", "V", "B", "N", "M", "Street"],
  ["CAPS", "SPACE", "Close"],
];
const TimeButton: React.FC<{
  label: string;
  onClick: () => void;
  isActive: boolean;
}> = ({ label, onClick, isActive }) => (
  <button
    onClick={onClick}
    className={`text-sm border-2 ${
      isActive
        ? "bg-yellow-200 border-l-gray-500 border-t-gray-500"
        : "bg-gray-300 border-r-gray-500 border-b-gray-500"
    }`}
  >
    {label}
  </button>
);
const RESTAURANT_COORDS = { easting: 448923, northing: 337520 };
interface LocationData {
  street: string;
  easting: number;
  northing: number;
  ward: string; // <-- Correct property name
}
// --- End of Helper Components ---

interface DeliveryAddressModalProps {
  customerInfo: CustomerInfo;
  onClose: () => void;
  onSave: (info: CustomerInfo) => void;
  initialFocusField: "postcode" | "name";
}

const DeliveryAddressModal: React.FC<DeliveryAddressModalProps> = ({
  customerInfo,
  onClose,
  onSave,
  initialFocusField,
}) => {
  // [MODIFY] Add 'town' to the form state
  const [formState, setFormState] = useState({
    postcode: "",
    street: "",
    houseNumber: "",
    town: "",
    ward: "",
    name: "",
    phone: "",
    instructions: "",
  });
  const [activeField, setActiveField] = useState<keyof typeof formState | null>(
    initialFocusField
  );
  const [postcodeDB, setPostcodeDB] = useState<Record<
    string,
    LocationData
  > | null>(null);
  const [distance, setDistance] = useState<number>(0);
  const [isCaps, setIsCaps] = useState(false);
  const [deliveryDateTime, setDeliveryDateTime] = useState(new Date());

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const postcodeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const houseNumberRef = useRef<HTMLInputElement>(null);

  const calculateDistance = (
    customerEasting: number,
    customerNorthing: number
  ) => {
    const eastingDiff = RESTAURANT_COORDS.easting - customerEasting;
    const northingDiff = RESTAURANT_COORDS.northing - customerNorthing;
    const distanceInMeters = Math.sqrt(
      Math.pow(eastingDiff, 2) + Math.pow(northingDiff, 2)
    );
    const distanceInMiles = distanceInMeters / 1609.34;
    setDistance(distanceInMiles);
  };

  useEffect(() => {
    // [GOOD] The condition is correct.
    if (customerInfo && postcodeDB) {
      console.log("Modal syncing with new customerInfo prop:", customerInfo);

      // [GOOD] This part is perfect. It populates all the text fields.
      setFormState({
        name: customerInfo.name || "",
        phone: customerInfo.phone || "",
        houseNumber: customerInfo.houseNumber || "",
        street: customerInfo.street || "",
        town: customerInfo.town || "",
        postcode: customerInfo.postcode || "",
        instructions: customerInfo.deliveryInstructions || "",
      });

      // ================== [THE IMPROVED LOGIC] ==================
      // First, check if a distance was provided by the backend.
      if (customerInfo.distance) {
        // If yes, this is our source of truth. Set it and we're done.
        setDistance(customerInfo.distance);
      }
      // If no distance was provided, THEN try to calculate it as a fallback.
      else if (customerInfo.postcode) {
        const locationData =
          postcodeDB[customerInfo.postcode.replace(/\s/g, "")];
        if (locationData) {
          calculateDistance(locationData.easting, locationData.northing);
        } else {
          // Calculation failed.
          setDistance(0);
        }
      }
      // If there's no distance and no postcode, the distance is 0.
      else {
        setDistance(0);
      }
      // ==========================================================
    }
  }, [customerInfo, postcodeDB]);

  useEffect(() => {
    if (postcodeData) {
      setPostcodeDB(postcodeData as Record<string, LocationData>);
    }
  }, []);

  useEffect(() => {
    if (initialFocusField === "postcode" && postcodeRef.current) {
      postcodeRef.current.focus();
    } else if (initialFocusField === "name" && nameRef.current) {
      nameRef.current.focus();
    }
  }, [initialFocusField]);

  // --- (All other helper functions like formatPostcode, handleKeyPress, etc. remain unchanged) ---
  const formatPostcode = (postcode: string): string => {
    const cleaned = postcode.toUpperCase().replace(/\s/g, "");
    if (cleaned.length < 4) return cleaned;
    const outward = cleaned.slice(0, -3);
    const inward = cleaned.slice(-3);
    return `${outward} ${inward}`;
  };
  const handlePostcodeLookup = () => {
    if (!formState.postcode || !postcodeDB) return;
    const formattedPostcode = formatPostcode(formState.postcode);
    const locationData = postcodeDB[formattedPostcode.replace(/\s/g, "")];
    if (locationData) {
      setFormState((prev) => ({
        ...prev,
        street: locationData.street,
        town: locationData.ward, // <-- Use .ward from the data to set the .town field in the form
      }));
      calculateDistance(locationData.easting, locationData.northing);
      houseNumberRef.current?.focus();
      setActiveField("houseNumber");
    } else {
      alert(`Details for postcode "${formattedPostcode}" not found.`);
      setDistance(0);
    }
  };
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };
  const handleClearField = (fieldName: keyof typeof formState) => {
    setFormState((prev) => ({ ...prev, [fieldName]: "" }));
  };
  const handleKeyPress = (key: string) => {
    switch (key) {
      case "Exit":
      case "Close":
        onClose();
        return;
      case "Enter":
        if (activeField === "postcode") handlePostcodeLookup();
        return;
      case "CAPS":
        setIsCaps((prev) => !prev);
        return;
      case "<- BS":
        if (activeField) {
          setFormState((prev) => ({
            ...prev,
            [activeField]: prev[activeField].slice(0, -1),
          }));
        }
        return;
      case "SPACE":
        if (activeField) {
          setFormState((prev) => ({
            ...prev,
            [activeField]: prev[activeField] + " ",
          }));
        }
        return;
      case "Tab":
      case "Street":
        return;
    }
    if (!activeField) return;
    const character = isCaps ? key.toUpperCase() : key.toLowerCase();
    setFormState((prev) => ({
      ...prev,
      [activeField]: prev[activeField] + character,
    }));
  };
  const handleSetDeliveryTimeFromNow = (minutes: number) => {
    const newTime = new Date();
    newTime.setMinutes(newTime.getMinutes() + minutes);
    setDeliveryDateTime(newTime);
  };
  const handleAdjustTime = (minutes: number) => {
    setDeliveryDateTime((prevTime) => {
      const newTime = new Date(prevTime);
      newTime.setMinutes(newTime.getMinutes() + minutes);
      return newTime;
    });
  };
  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };
  const timeSlots = [
    { label: "15 mins", mins: 15 },
    { label: "20 mins", mins: 20 },
    { label: "25 mins", mins: 25 },
    { label: "30 mins", mins: 30 },
    { label: "40 mins", mins: 40 },
    { label: "45 mins", mins: 45 },
    { label: "50 mins", mins: 50 },
    { label: "55 mins", mins: 55 },
    { label: "1 Hour", mins: 60 },
  ];

  // =====================================================================
  //               MODIFIED handleSave FUNCTION
  // =====================================================================
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    const addressParts = [];
    const houseAndStreet = [formState.houseNumber, formState.street]
      .filter(Boolean)
      .join(" ");
    if (houseAndStreet) {
      addressParts.push(houseAndStreet);
    }
    if (formState.town) {
      addressParts.push(formState.town);
    } // [ADD] Include town in final address string
    if (formState.postcode) {
      addressParts.push(formatPostcode(formState.postcode));
    }

    const finalAddress = addressParts.join(", ");

    // [MODIFY] Add town and distance to the saved data
    const savedInfo: CustomerInfo = {
      name: formState.name,
      phone: formState.phone,
      address: finalAddress,
      houseNumber: formState.houseNumber,
      street: formState.street,
      town: formState.town,
      postcode: formState.postcode,
      distance: distance, // Add the distance
      deliveryInstructions: formState.instructions,
    };

    try {
      if (savedInfo.phone && savedInfo.address) {
        // [MODIFY] Send the new 'town' field to the backend
        const response = await fetch(
          "http://localhost:4000/api/verify-address",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: savedInfo.phone,
              address: savedInfo.address,
              postcode: formState.postcode,
              houseNumber: formState.houseNumber,
              street: formState.street,
              town: formState.town, // Send town to API
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || "Failed to save to customer database."
          );
        }
        console.log(`[CRM] Address for ${savedInfo.phone} saved successfully.`);
      }

      onSave(savedInfo);
    } catch (error: any) {
      console.error("Failed to save customer address:", error);
      setSaveError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-300 w-full h-full flex flex-col p-2 gap-2">
        <div className="flex-shrink-0 bg-blue-700 text-white p-1 text-lg font-bold flex justify-between">
          <span>Order Address</span>
          <div>
            <PosButton>F4 Collect 领取</PosButton>
            <PosButton>At Shop 当场</PosButton>
          </div>
        </div>
        <div className="flex-grow flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 h-[55%]">
            <div className="flex flex-col gap-y-2">
              <div className="flex items-center gap-2">
                <InputField
                  ref={postcodeRef}
                  label="Postcode 邮编"
                  value={formState.postcode}
                  onFocus={() => setActiveField("postcode")}
                  onChange={(e: any) =>
                    setFormState((prev) => ({
                      ...prev,
                      postcode: e.target.value,
                    }))
                  }
                  onClear={() => handleClearField("postcode")}
                  className="flex-grow"
                />
                <PosButton className="h-7" onClick={handlePostcodeLookup}>
                  🔍 Lookup
                </PosButton>
              </div>
              <InputField
                label="Distance 距离"
                value={distance > 0 ? `${distance.toFixed(2)} miles` : ""}
                onFocus={() => setActiveField(null)}
                onClear={() => {}}
                readOnly={true}
                className="flex-grow"
              />
              <InputField
                ref={houseNumberRef}
                label="House Number 门牌"
                value={formState.houseNumber}
                onFocus={() => setActiveField("houseNumber")}
                onChange={(e: any) =>
                  setFormState((prev) => ({
                    ...prev,
                    houseNumber: e.target.value,
                  }))
                }
                onClear={() => handleClearField("houseNumber")}
              />
              <InputField
                label="Street 街道"
                value={formState.street}
                onFocus={() => setActiveField("street")}
                onChange={(e: any) =>
                  setFormState((prev) => ({ ...prev, street: e.target.value }))
                }
                onClear={() => handleClearField("street")}
              />

              {/* [ADD] The new InputField for Town */}
              <InputField
                label="Town / City 城镇"
                value={formState.town}
                onFocus={() => setActiveField(null)}
                onClear={() => {}}
                readOnly={true}
              />

              <InputField
                ref={nameRef}
                label="Name 姓名"
                value={formState.name}
                onFocus={() => setActiveField("name")}
                onChange={(e: any) =>
                  setFormState((prev) => ({ ...prev, name: e.target.value }))
                }
                onClear={() => handleClearField("name")}
              />
              <InputField
                label="电话"
                value={formState.phone}
                onFocus={() => setActiveField("phone")}
                onChange={(e: any) =>
                  setFormState((prev) => ({ ...prev, phone: e.target.value }))
                }
                onClear={() => handleClearField("phone")}
              />
              <div className="flex items-center gap-2 mt-1">
                <label className="w-24 text-right pr-2">Time 时间</label>
                <div className="grid grid-cols-5 grid-rows-2 gap-1 flex-grow">
                  {timeSlots.map((time) => (
                    <TimeButton
                      key={time.label}
                      label={time.label}
                      onClick={() => handleSetDeliveryTimeFromNow(time.mins)}
                      isActive={false}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <PosButton
                    className="w-8 h-10 text-xl"
                    onClick={() => handleAdjustTime(-5)}
                  >
                    -
                  </PosButton>
                  <div className="w-20 h-10 bg-black text-yellow-400 text-2xl font-mono flex items-center justify-center">
                    {formatTime(deliveryDateTime)}
                  </div>
                  <PosButton
                    className="w-8 h-10 text-xl"
                    onClick={() => handleAdjustTime(5)}
                  >
                    +
                  </PosButton>
                </div>
              </div>
              <div className="flex">
                <label className="w-24 text-right pr-2 pt-1">
                  Instruction 指示
                </label>
                <textarea
                  name="instructions"
                  value={formState.instructions}
                  onFocus={() => setActiveField("instructions")}
                  onChange={handleInputChange}
                  className="w-full h-16 bg-white border border-gray-400 p-1 flex-grow"
                />
              </div>
            </div>
            {/* ... (Rest of the JSX is unchanged) ... */}
            <div className="flex items-center justify-center">
              <PosButton className="w-12 h-24 text-4xl" disabled={true}>
                {" "}
                «{" "}
              </PosButton>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex-grow bg-white border-2 border-t-gray-500 border-l-gray-500"></div>
              {saveError && (
                <div className="text-red-600 font-bold text-center p-1 bg-red-100 border border-red-500">
                  {saveError}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <PosButton
                  className="bg-red-500 text-white h-10"
                  onClick={onClose}
                  disabled={isSaving}
                >
                  Close 取消
                </PosButton>
                <PosButton
                  className="bg-blue-500 text-white h-10"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "F12 OK 確認"}
                </PosButton>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 grid gap-1 mt-auto">
            {keyboardLayout.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-1 justify-center">
                {" "}
                {row.map((key) => (
                  <PosButton
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className={`h-10 text-sm ${
                      key === "SPACE" ? "flex-grow" : "w-20"
                    } ${key === "CAPS" && isCaps ? "bg-yellow-300" : ""}`}
                  >
                    {" "}
                    {key}{" "}
                  </PosButton>
                ))}{" "}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryAddressModal;
