import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { ConfirmationResult } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Globe, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

type Step = 'phone' | 'otp' | 'loading';
type Lang = 'fr' | 'ar';

export default function Login() {
  const { signIn, verify } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('phone');
  const [lang, setLang] = useState<Lang>('fr');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Translations
  const t = {
    fr: {
      tagline: "La facturation conforme DGI, simple comme un message",
      phoneLabel: "Numéro de téléphone",
      phonePlaceholder: "6 12 34 56 78",
      continue: "Continuer",
      verify: "Vérifier le code",
      otpTitle: "Vérification",
      otpSubtitle: "Veuillez saisir le code à 6 chiffres envoyé au",
      back: "Modifier le numéro",
      errors: {
        invalid_phone: "Le format du numéro de téléphone est invalide.",
        wrong_otp: "Ce code est incorrect. Veuillez réessayer.",
        expired: "Le code est expiré. Veuillez recommencer.",
        rate_limited: "Trop de tentatives. Veuillez patienter un moment.",
        generic: "Une erreur inattendue s'est produite."
      }
    },
    ar: {
      tagline: "فواتير مطابقة لمديرية الضرائب، سهلة كرسالة",
      phoneLabel: "رقم الهاتف",
      phonePlaceholder: "6 12 34 56 78",
      continue: "متابعة",
      verify: "تحقق من الرمز",
      otpTitle: "رمز التحقق",
      otpSubtitle: "أدخل الرمز المكون من 6 أرقام المرسل إلى",
      back: "تعديل الرقم",
      errors: {
        invalid_phone: "تنسيق رقم الهاتف غير صالح.",
        wrong_otp: "هذا الرمز غير صحيح. حاول مرة أخرى.",
        expired: "انتهت صلاحية الرمز. يرجى المحاولة من جديد.",
        rate_limited: "محاولات كثيرة جدا. يرجى الانتظار.",
        generic: "حدث خطأ غير متوقع."
      }
    }
  };

  const txt = t[lang];

  // Map bilingual toggle gracefully
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phone || phone.length < 9) {
      setError(txt.errors.invalid_phone);
      return;
    }

    setIsLoading(true);
    try {
      const res = await signIn(phone, 'recaptcha-container');
      setConfirmationResult(res);
      setStep('otp');
      // Timeout needed to allow DOM to render inputs before focusing
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-phone-number') setError(txt.errors.invalid_phone);
      else if (err.code === 'auth/too-many-requests') setError(txt.errors.rate_limited);
      else setError(txt.errors.generic);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!/^\d*$/.test(val)) return;

    const newOtp = [...otp];
    newOtp[index] = val.slice(-1); // Guarantee single digit extraction
    setOtp(newOtp);

    // Auto-advance directly bounding indices
    if (val && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'Enter') {
      handleOtpSubmit(e as any);
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').slice(0, 6).replace(/\D/g, '');
    if (pasted) {
      const newOtp = [...otp];
      for (let i = 0; i < pasted.length && i < 6; i++) {
        newOtp[i] = pasted[i];
      }
      setOtp(newOtp);
      // Focus on the next available box following paste mapping
      const nextIndex = Math.min(pasted.length, 5);
      otpRefs.current[nextIndex]?.focus();
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) return;

    setError(null);
    setIsLoading(true);

    try {
      await verify(confirmationResult!, code);
      setStep('loading');
      
      // Delay navigation logic natively to let the AuthContext catch up!
      // In production, the AuthContext `user` listener handles the exact boundaries. 
      // Login simply pushes the layout view redirect safely if the context is updating.
      setTimeout(() => {
         // Relying on route protection in App.js. 
         // But purely for transition smoothness we navigate to root so it can assess boundaries.
         navigate('/');
      }, 1500);

    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-verification-code') setError(txt.errors.wrong_otp);
      else if (err.code === 'auth/code-expired') setError(txt.errors.expired);
      else setError(txt.errors.generic);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-[#5FA8D3] selection:text-white">
      {/* Invisible Recaptcha target bounding */}
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative border border-slate-100">
        
        {/* Bilingual Configuration Toggle */}
        <button
          onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
          className="absolute top-6 border border-slate-200 right-6 flex items-center space-x-2 bg-white/50 backdrop-blur-md px-3 py-1.5 rounded-full text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors z-10 
          rtl:right-auto rtl:left-6 rtl:space-x-reverse"
        >
          <Globe className="w-4 h-4" />
          <span>{lang === 'fr' ? 'العربية' : 'Français'}</span>
        </button>

        <div className="pt-12 px-8 pb-8">
          
          {/* Header Area */}
          <div className="mb-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1B4965]/10 mb-6 mx-auto">
              {/* Replace with real Fatura Logo Vector */}
              <div className="w-8 h-8 rounded-lg bg-[#1B4965] flex items-center justify-center">
                <span className="text-white font-bold text-xl leading-none">F</span>
              </div>
            </div>
            
            {step === 'phone' && (
              <>
                <h1 className="text-2xl font-bold text-[#1B4965] mb-2 tracking-tight">Fatura</h1>
                <p className="text-sm font-medium text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                  {txt.tagline}
                </p>
              </>
            )}

            {step === 'otp' && (
              <>
                <h1 className="text-2xl font-bold text-[#1B4965] mb-2 tracking-tight">{txt.otpTitle}</h1>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {txt.otpSubtitle} <br/>
                  <span className="font-semibold text-slate-900 dir-ltr inline-block mt-1">+212 {phone}</span>
                </p>
              </>
            )}
          </div>

          {/* Alert Error Box */}
          {error && (
            <div className="mb-6 bg-red-50 text-red-600 text-sm font-medium px-4 py-3 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Flow Boundaries */}
          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 block">{txt.phoneLabel}</label>
                <div className="relative flex items-center">
                  <div className="absolute left-4 rtl:left-auto rtl:right-4 flex items-center space-x-2 rtl:space-x-reverse z-10 pointer-events-none">
                    <span className="text-lg">🇲🇦</span>
                    <span className="text-slate-400 font-medium">+212</span>
                    <div className="w-px h-5 bg-slate-200 ml-2 rtl:ml-0 rtl:mr-2"></div>
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder={txt.phonePlaceholder}
                    className="w-full pl-[5.5rem] rtl:pl-4 rtl:pr-[5.5rem] pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-medium placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:border-[#5FA8D3] focus:bg-white transition-all dir-ltr text-left"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || phone.length < 9}
                className="w-full flex items-center justify-center space-x-2 rtl:space-x-reverse bg-[#1B4965] hover:bg-[#153a51] text-white py-3.5 rounded-2xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_0_rgb(27,73,101,0.39)] hover:shadow-[0_6px_20px_rgba(27,73,101,0.23)] active:scale-[0.98]"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{txt.continue}</span>
                    <ArrowRight className="w-5 h-5 rtl:rotate-180" />
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="space-y-8 animate-in slide-in-from-right-4 fade-in">
              <div className="flex justify-between gap-2 dir-ltr">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={handleOtpPaste}
                    className="w-12 h-14 text-center text-xl font-bold bg-slate-50 border-2 border-slate-100 rounded-xl text-slate-900 focus:outline-none focus:border-[#5FA8D3] focus:bg-white transition-all"
                  />
                ))}
              </div>

              <div className="flex flex-col gap-4">
                <button
                  type="submit"
                  disabled={isLoading || otp.join('').length !== 6}
                  className="w-full flex items-center justify-center space-x-2 rtl:space-x-reverse bg-[#1B4965] hover:bg-[#153a51] text-white py-3.5 rounded-2xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_0_rgb(27,73,101,0.39)] active:scale-[0.98]"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>{txt.verify}</span>}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
                    setOtp(['', '', '', '', '', '']);
                    setError(null);
                  }}
                  className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                >
                  {txt.back}
                </button>
              </div>
            </form>
          )}

          {step === 'loading' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 animate-in zoom-in-95 fade-in">
               <div className="relative">
                 <div className="absolute inset-0 bg-[#5FA8D3] blur-xl opacity-30 rounded-full animate-pulse"></div>
                 <CheckCircle2 className="w-16 h-16 text-[#5FA8D3] relative z-10" />
               </div>
               <p className="text-slate-600 font-medium">Connexion réussie...</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
