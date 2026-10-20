import React from 'react';
import { 
  Zap, 
  ShieldCheck, 
  Check, 
  CreditCard, 
  ChevronRight,
  X,
  MessageCircle,
  MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { AppUser, Customer, Supplier } from '../App';

interface SubscriptionScreenProps {
  user: AppUser | null;
  updateUser: (data: Partial<AppUser>) => Promise<void>;
  theme: 'light' | 'dark';
  navigate: (path: string) => void;
  isSubscriptionActive: (user: AppUser | null) => boolean;
  toJSDate: (timestamp: any) => Date;
  cn: (...inputs: any[]) => string;
  Layout: React.FC<any>;
}

export const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({
  user,
  updateUser,
  theme,
  navigate,
  isSubscriptionActive,
  toJSDate,
  cn,
  Layout
}) => {
  const [loading, setLoading] = React.useState(false);

  const handlePayment = async () => {
    if (!user) return;
    
    // Temporarily disabled for testing
    alert("प्रीमियम सब्सक्रिप्शन अभी टेस्टिंग में है। आप बिना भुगतान के फीचर्स का उपयोग कर सकते हैं।");
    return;
  };

  const isSubscribed = isSubscriptionActive(user);
  const expiryDate = user?.subscriptionExpiry ? format(toJSDate(user.subscriptionExpiry), 'dd MMM yyyy') : null;

  return (
    <Layout title="प्रीमियम सदस्यता" showBack backTo="/" hideLogout>
      <div className="p-6 space-y-8">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-xl shadow-indigo-100 animate-pulse">
            <Zap size={40} fill="currentColor" />
          </div>
          <div className="space-y-2">
            <h2 className={cn("text-3xl font-black tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>
              KhataBook Premium
            </h2>
            <p className="text-slate-500 font-medium">अपने व्यापार को अगले स्तर पर ले जाएं</p>
          </div>
        </div>

        {isSubscribed ? (
          <div className={cn(
            "p-8 rounded-[2.5rem] border-2 border-emerald-100 text-center space-y-4",
            theme === 'dark' ? "bg-emerald-900/20 border-emerald-900/30" : "bg-emerald-50"
          )}>
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldCheck size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-emerald-700">प्रीमियम सक्रिय है</h3>
              <p className="text-emerald-600/80 font-bold text-sm uppercase tracking-wider">वैधता: {expiryDate}</p>
            </div>
            <p className="text-slate-500 text-sm">अब आप बिना किसी रुकावट के बल्क मैसेज भेज सकते हैं।</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Testing Notice */}
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                <Zap size={16} fill="currentColor" />
              </div>
              <p className="text-xs font-bold text-amber-700">प्रीमियम सब्सक्रिप्शन अभी टेस्टिंग में है।</p>
            </div>

            <div className={cn(
              "p-8 rounded-[2.5rem] border-2 border-indigo-100 space-y-6",
              theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
            )}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black">प्रीमियम प्लान</h3>
                <div className="bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                  ₹1 / महीना
                </div>
              </div>
              
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check size={12} />
                  </div>
                  <p className="text-sm font-bold text-slate-600">अनलिमिटेड बल्क मैसेज (WhatsApp/SMS)</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check size={12} />
                  </div>
                  <p className="text-sm font-bold text-slate-600">प्रीमियम सपोर्ट और अपडेट्स</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check size={12} />
                  </div>
                  <p className="text-sm font-bold text-slate-600">कोई विज्ञापन नहीं (Ad-Free Experience)</p>
                </li>
              </ul>

              <div className="space-y-3">
                <button 
                  onClick={handlePayment}
                  disabled={true}
                  className="w-full py-4 bg-slate-200 text-slate-500 rounded-2xl font-black transition-all flex items-center justify-center gap-3 cursor-not-allowed"
                >
                  <CreditCard size={20} />
                  अभी सब्सक्राइब करें
                </button>
                <p className="text-[10px] text-center text-amber-600 font-bold uppercase tracking-wider">
                  पेमेंट फिलहाल बंद है
                </p>
              </div>
            </div>
            
            <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              सुरक्षित भुगतान Razorpay द्वारा संचालित
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

interface BulkMessageUIProps {
  isBulkMode: boolean;
  selectedItemIds: string[];
  activeTab: 'customers' | 'suppliers';
  handleOpenBulkModal: () => void;
  isBulkModalOpen: boolean;
  setIsBulkModalOpen: (val: boolean) => void;
  bulkMessage: string;
  setBulkMessage: (val: string) => void;
  handleSendBulkMessage: (type: 'whatsapp' | 'sms') => void;
  theme: 'light' | 'dark';
  cn: (...inputs: any[]) => string;
}

export const BulkMessageUI: React.FC<BulkMessageUIProps> = ({
  isBulkMode,
  selectedItemIds,
  activeTab,
  handleOpenBulkModal,
  isBulkModalOpen,
  setIsBulkModalOpen,
  bulkMessage,
  setBulkMessage,
  handleSendBulkMessage,
  theme,
  cn
}) => {
  return (
    <>
      {/* Bulk Action Bar */}
      <AnimatePresence>
        {isBulkMode && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-20 left-4 right-4 z-40"
          >
            <div className="bg-indigo-600 text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs font-bold opacity-80 uppercase tracking-widest">चुने गए {activeTab === 'customers' ? 'ग्राहक' : 'सप्लायर'}</p>
                <p className="text-lg font-black">{selectedItemIds.length}</p>
              </div>
              <button 
                onClick={handleOpenBulkModal}
                className="px-6 py-3 bg-white text-indigo-600 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all"
              >
                मैसेज भेजें
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Message Modal */}
      <AnimatePresence>
        {isBulkModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBulkModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className={cn(
                "relative w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto",
                theme === 'dark' ? "bg-slate-900" : "bg-white"
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black">बल्क मैसेज भेजें</h2>
                <button onClick={() => setIsBulkModalOpen(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">मैसेज फॉर्मेट</p>
                  <textarea 
                    rows={5}
                    value={bulkMessage}
                    onChange={(e) => setBulkMessage(e.target.value)}
                    className={cn(
                      "w-full bg-transparent border-none focus:outline-none text-sm font-medium resize-none",
                      theme === 'dark' ? "text-white" : "text-slate-900"
                    )}
                    placeholder="अपना मैसेज यहाँ लिखें..."
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-white dark:bg-slate-800 text-[8px] font-bold rounded border border-indigo-100 dark:border-indigo-800">{'{name}'}</span>
                    <span className="px-2 py-1 bg-white dark:bg-slate-800 text-[8px] font-bold rounded border border-indigo-100 dark:border-indigo-800">{'{shopName}'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleSendBulkMessage('whatsapp')}
                    className="flex flex-col items-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-2xl group active:scale-95 transition-all"
                  >
                    <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-none">
                      <MessageCircle size={20} />
                    </div>
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">WhatsApp</span>
                  </button>
                  <button 
                    onClick={() => handleSendBulkMessage('sms')}
                    className="flex flex-col items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl group active:scale-95 transition-all"
                  >
                    <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
                      <MessageSquare size={20} />
                    </div>
                    <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">SMS</span>
                  </button>
                </div>

                <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                  नोट: ब्राउज़र सुरक्षा के कारण, हर ग्राहक के लिए अलग टैब खुलेगा। कृपया एक-एक करके मैसेज भेजें।
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
