import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CustomerInfo, Address } from '../../types';
import { Button } from '../ui/button';
import { X, Search, Phone, MapPin, Clock, MessageSquare, Save } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { apiClient } from '../../api/client';
import { AddressSelectionModal } from './address-selection-modal';

interface DeliveryAddressModalProps {
  customerInfo: CustomerInfo;
  onClose: () => void;
  onSave: (info: CustomerInfo) => void;
}

const TIME_SLOTS = [
  { label: '15m', mins: 15 },
  { label: '20m', mins: 20 },
  { label: '30m', mins: 30 },
  { label: '45m', mins: 45 },
  { label: '1h', mins: 60 },
  { label: '1.5h', mins: 90 },
];

export function DeliveryAddressModal({
  customerInfo,
  onClose,
  onSave,
}: DeliveryAddressModalProps) {
  const [formData, setFormData] = useState<CustomerInfo>({
    name: '',
    phone: '',
    postcode: '',
    houseNumber: '',
    street: '',
    town: '',
    deliveryInstructions: '',
    distance: 0,
    ...customerInfo,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Address[]>([]);
  const [showAddressPicker, setShowAddressPicker] = useState(false);

  useEffect(() => {
    // Sync with prop
    setFormData(prev => ({ ...prev, ...customerInfo }));
  }, [customerInfo]);

  const handlePostcodeLookup = async () => {
    if (!formData.postcode) return;
    setIsLoading(true);
    try {
      const { addresses } = await apiClient.lookupPostcode(formData.postcode);
      if (addresses.length === 1) {
        const addr = addresses[0];
        setFormData(prev => ({
          ...prev,
          street: addr.line1,
          town: addr.town || '',
          postcode: addr.postcode,
        }));
      } else if (addresses.length > 1) {
        setSearchResults(addresses);
        setShowAddressPicker(true);
      } else {
        alert('Postcode not found');
      }
    } catch (err) {
      console.error('Postcode lookup failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneLookup = async () => {
    if (!formData.phone) return;
    setIsLoading(true);
    try {
      const { customer } = await apiClient.fetchCustomer(formData.phone);
      if (customer) {
        setFormData(prev => ({
            ...prev,
            name: customer.name || '',
            phone: customer.phone,
            postcode: customer.postcode || '',
            houseNumber: customer.houseNumber || '',
            street: customer.street || '',
            town: customer.town || '',
            distance: customer.distance || 0,
        }));
      }
    } catch (err) {
      console.log('Customer not found', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddressSelect = (addr: Address) => {
    setFormData(prev => ({
      ...prev,
      street: addr.line1,
      town: addr.town || '',
      postcode: addr.postcode,
    }));
    setShowAddressPicker(false);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
        const addressData: Partial<Address> = {
            line1: formData.street,
            town: formData.town,
            postcode: formData.postcode,
        };
        const { customer } = await apiClient.verifyAddress(formData.phone || '0000', addressData);
        
        onSave({
            ...formData,
            phone: customer.phone,
            distance: customer.distance || 0,
            address: `${formData.houseNumber || ''} ${formData.street || ''}, ${formData.town || ''}, ${formData.postcode || ''}`.trim().replace(/^, /, ''),
        });
    } catch (err) {
        const withStatus = err as Error & { status?: number };
        if (withStatus?.status && withStatus.status !== 404) {
          console.error('Verify address failed', err);
        }
        onSave(formData);
    } finally {
        setIsLoading(false);
    }
  };

  const setDeliveryTime = (mins: number) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + mins);
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    setFormData(prev => ({ ...prev, deliveryTime: timeStr }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        transition={{ type: 'spring', duration: 0.4, bounce: 0.1 }}
        className="pos-panel flex h-[90vh] w-full max-w-5xl flex-col shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg border border-primary/20">
                <MapPin className="h-6 w-6 text-primary" />
            </div>
            <div className="flex flex-col">
                <span className="pos-kicker text-primary">Delivery Details</span>
                <span className="font-display text-xl font-black tracking-tight uppercase">
                    Customer Information
                </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-6 w-6" />
          </Button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          <ScrollArea className="flex-1 p-6 md:border-r border-border/40">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <Phone className="h-3 w-3" /> Phone Number
                    </label>
                    <div className="flex gap-2">
                        <Input 
                            value={formData.phone}
                            onChange={e => setFormData(p => ({...p, phone: e.target.value}))}
                            placeholder="07..."
                            className="h-14 text-xl font-mono font-bold bg-background/50 border-border/60 focus:border-primary/50"
                        />
                        <Button variant="secondary" size="icon" className="h-14 w-14 shrink-0" onClick={handlePhoneLookup} disabled={isLoading}>
                            <Search className="h-5 w-5" />
                        </Button>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        Customer Name
                    </label>
                    <Input 
                        value={formData.name}
                        onChange={e => setFormData(p => ({...p, name: e.target.value}))}
                        placeholder="John Doe"
                        className="h-14 text-lg font-semibold bg-background/50 border-border/60"
                    />
                 </div>
              </div>

              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <MapPin className="h-3 w-3" /> Postcode
                    </label>
                    <div className="flex gap-2">
                        <Input 
                            value={formData.postcode}
                            onChange={e => setFormData(p => ({...p, postcode: e.target.value.toUpperCase()}))}
                            placeholder="NG9 1AA"
                            className="h-14 text-xl font-mono font-bold bg-background/50 border-border/60 uppercase"
                        />
                        <Button variant="default" size="icon" className="h-14 w-14 shrink-0 shadow-lg shadow-primary/20" onClick={handlePostcodeLookup} disabled={isLoading}>
                            <Search className="h-5 w-5" />
                        </Button>
                    </div>
                 </div>

                 <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2 col-span-1">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                            House #
                        </label>
                        <Input 
                            value={formData.houseNumber}
                            onChange={e => setFormData(p => ({...p, houseNumber: e.target.value}))}
                            placeholder="12"
                            className="h-14 text-lg font-bold bg-background/50 text-center"
                        />
                    </div>
                    <div className="space-y-2 col-span-3">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                            Street Name
                        </label>
                        <Input 
                            value={formData.street}
                            onChange={e => setFormData(p => ({...p, street: e.target.value}))}
                            className="h-14 text-lg font-semibold bg-background/50"
                        />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        Town / City
                    </label>
                    <Input 
                        value={formData.town}
                        onChange={e => setFormData(p => ({...p, town: e.target.value}))}
                        className="h-14 text-lg font-semibold bg-background/50"
                    />
                 </div>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border/40">
                 <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <Clock className="h-3 w-3" /> Requested Time
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {TIME_SLOTS.map(slot => (
                            <Button 
                                key={slot.label} 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setDeliveryTime(slot.mins)}
                                className="h-12 text-xs font-bold"
                            >
                                {slot.label}
                            </Button>
                        ))}
                    </div>
                    <div className="flex items-center gap-4 bg-muted/40 p-4 rounded-xl border border-border/60">
                        <span className="text-xl font-mono font-black text-primary">
                            {formData.deliveryTime || '--:--'}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            ETA
                        </span>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <MessageSquare className="h-3 w-3" /> Delivery Instructions
                    </label>
                    <textarea 
                        value={formData.deliveryInstructions}
                        onChange={e => setFormData(p => ({...p, deliveryInstructions: e.target.value}))}
                        placeholder="e.g. Leave at front door"
                        className="w-full h-32 rounded-xl border border-border/60 bg-background/50 p-3 text-sm focus:border-primary/50 focus:outline-none resize-none"
                    />
                 </div>
              </div>
            </div>
          </ScrollArea>

          <div className="w-full md:w-80 bg-muted/10 p-6 flex flex-col gap-6">
             <div className="space-y-4">
                <span className="pos-kicker flex items-center gap-2">
                    <MapPin className="h-3 w-3" /> Location Summary
                </span>
                <div className="space-y-2 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Distance:</span>
                        <span className="font-mono font-bold text-accent">
                            {formData.distance ? `${formData.distance.toFixed(2)} mi` : '---'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Area:</span>
                        <span className="font-semibold">{formData.town || '---'}</span>
                    </div>
                </div>
             </div>

             <div className="mt-auto space-y-3">
                <Button variant="outline" className="w-full h-14 text-base font-semibold" onClick={onClose} disabled={isLoading}>
                    Cancel
                </Button>
                <Button className="w-full h-16 text-xl font-black shadow-xl shadow-primary/20 gap-3" onClick={handleSave} disabled={isLoading}>
                    <Save className="h-6 w-6" /> SAVE
                </Button>
             </div>
          </div>
        </div>

        <AnimatePresence>
          {showAddressPicker && (
            <AddressSelectionModal 
              key="address-picker"
              addresses={searchResults} 
              onSelect={handleAddressSelect} 
              onClose={() => setShowAddressPicker(false)} 
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
