import React, { useState } from 'react';
import { Download, Share, PlusSquare, X, CheckCircle2, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card' | 'settings';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (isInstallable) {
      const installed = await install();
      if (installed) {
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 4000);
      }
    } else {
      // If neither prompt is active, still show helpful instructions
      setShowIOSGuide(true);
    }
  };

  // If already installed and on compact/home view, hide it
  if (isInstalled && variant === 'compact') {
    return null;
  }

  // If installed and on settings view, show verified badge
  if (isInstalled && (variant === 'settings' || variant === 'card')) {
    return (
      <div className={`flex items-center justify-between p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <h4 className="text-sm font-bold">Ứng dụng đã được cài đặt</h4>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Bạn đang dùng HabitFlow dưới dạng ứng dụng độc lập (PWA).</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-xs font-bold transition-all active:scale-95 border border-indigo-100 dark:border-indigo-900/50 shadow-sm ${className}`}
          title="Cài đặt HabitFlow lên màn hình chính"
        >
          <Download className="w-3.5 h-3.5 stroke-[2]" />
          <span>Cài app</span>
        </button>
      ) : (
        <div className={`bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent dark:from-indigo-950/40 dark:via-purple-950/20 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-900/40 shadow-sm ${className}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 dark:shadow-none flex-shrink-0">
                <Smartphone className="w-6 h-6 stroke-[1.75]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Cài đặt ứng dụng PWA</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Cài đặt HabitFlow lên màn hình chính điện thoại hoặc máy tính để mở nhanh và dùng mượt mà như app native.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-indigo-100/60 dark:border-indigo-900/40 flex items-center justify-end">
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
            >
              <Download className="w-4 h-4 stroke-[2]" />
              <span>Cài đặt lên thiết bị</span>
            </button>
          </div>
        </div>
      )}

      {/* Guide Modal for iOS Safari / Manual Installation */}
      <AnimatePresence>
        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIOSGuide(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-700 z-10"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-base">
                  <Smartphone className="w-5 h-5 stroke-[2]" />
                  <span>Cài đặt HabitFlow</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3.5 text-slate-700 dark:text-slate-200 text-sm">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Để trải nghiệm toàn màn hình và dùng ngoại tuyến tốt nhất:
                </p>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    1
                  </div>
                  <div className="text-xs leading-relaxed">
                    Nhấn vào biểu tượng <strong className="text-slate-900 dark:text-white inline-flex items-center gap-1 mx-1"><Share className="w-3.5 h-3.5 inline" /> Chia sẻ (Share)</strong> ở thanh công cụ trình duyệt Safari / Chrome.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    2
                  </div>
                  <div className="text-xs leading-relaxed">
                    Cuộn xuống và chọn <strong className="text-slate-900 dark:text-white inline-flex items-center gap-1 mx-1"><PlusSquare className="w-3.5 h-3.5 inline" /> Thêm vào MH chính (Add to Home Screen)</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    3
                  </div>
                  <div className="text-xs leading-relaxed">
                    Nhấn <strong className="text-slate-900 dark:text-white">Thêm (Add)</strong> ở góc phải trên cùng để hoàn tất.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition shadow-md shadow-indigo-200 dark:shadow-none"
              >
                Đã hiểu
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success toast */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>HabitFlow đã được thêm vào thiết bị của bạn!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
