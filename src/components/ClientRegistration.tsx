import { useState } from "react";
import { Scale, User, Mail, Phone, Shield, ChevronRight, AlertCircle, CheckSquare, Square } from "lucide-react";
import { supabase } from "../lib/supabase";

interface ClientRegistrationProps {
  onComplete: (client: { id: string; name: string; email: string; phone: string }) => void;
}

export default function ClientRegistration({ onComplete }: ClientRegistrationProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Full name is required";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Valid email is required";
    if (!phone.trim() || phone.replace(/\D/g, "").length < 10) e.phone = "Valid phone number is required";
    if (!agreed) e.agreed = "You must review and agree to the disclosure to continue.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleStart() {
    if (!validate()) return;
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from("clients")
        .select("id, name, email, phone, status")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (existing) {
        await supabase.from("clients").update({
          name: name.trim(),
          phone: phone.trim(),
          last_activity: new Date().toISOString(),
          status: existing.status === "registered" ? "intake_in_progress" : existing.status,
        }).eq("id", existing.id);
        onComplete({ id: existing.id, name: name.trim(), email: email.trim(), phone: phone.trim() });
        return;
      }

      const { data: newClient, error } = await supabase
        .from("clients")
        .insert({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          status: "intake_in_progress",
        })
        .select("id, name, email, phone")
        .single();

      if (error) throw error;
      onComplete(newClient);
    } catch {
      setErrors({ general: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-400/10 rounded-2xl border border-amber-400/20 mb-6">
            <Scale size={36} className="text-amber-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">bankruptcy<span className="text-amber-400">.AI</span></h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Before starting your intake form, we need a few details so our team can follow up with you.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-10 shadow-2xl shadow-black/40">
          <h2 className="text-white font-bold text-2xl mb-8">Let's get started</h2>

          {errors.general && (
            <div className="mb-6 flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4">
              <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-base">{errors.general}</p>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2.5">Full Name</label>
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="John Smith"
                  className={`w-full bg-slate-800 border rounded-xl pl-12 pr-4 py-4 text-white text-base focus:outline-none placeholder-slate-500 transition-colors ${errors.name ? "border-red-500/60 focus:border-red-500" : "border-slate-600 focus:border-amber-400/60"}`}
                />
              </div>
              {errors.name && <p className="text-red-400 text-sm mt-2">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2.5">Email Address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className={`w-full bg-slate-800 border rounded-xl pl-12 pr-4 py-4 text-white text-base focus:outline-none placeholder-slate-500 transition-colors ${errors.email ? "border-red-500/60 focus:border-red-500" : "border-slate-600 focus:border-amber-400/60"}`}
                />
              </div>
              {errors.email && <p className="text-red-400 text-sm mt-2">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-amber-400 uppercase tracking-widest mb-2.5">Phone Number</label>
              <div className="relative">
                <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  className={`w-full bg-slate-800 border rounded-xl pl-12 pr-4 py-4 text-white text-base focus:outline-none placeholder-slate-500 transition-colors ${errors.phone ? "border-red-500/60 focus:border-red-500" : "border-slate-600 focus:border-amber-400/60"}`}
                />
              </div>
              {errors.phone && <p className="text-red-400 text-sm mt-2">{errors.phone}</p>}
            </div>
          </div>

          {/* Disclosure */}
          <div className="mt-8 bg-slate-800/60 border border-slate-700 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Shield size={15} className="text-amber-400 flex-shrink-0" />
              <p className="text-amber-400 text-xs font-bold uppercase tracking-wider">Important Disclosures</p>
            </div>
            <div className="space-y-2.5 text-sm text-slate-300 leading-relaxed">
              <p>
                By registering, you authorize <strong className="text-white">Bradford Law LLC</strong> to contact you by phone, text message, and email regarding your case inquiry. Message and data rates may apply. You may opt out at any time by replying STOP to any text message or contacting our office.
              </p>
              <p>
                If we accept your case, you agree to provide all requested information and documentation electronically through our secure client portal. <strong className="text-white">We do not accept physical documents</strong> — all documents must be submitted digitally via our secure upload system.
              </p>
              <p>
                Submitting this form does not create an attorney-client relationship. An attorney-client relationship is established only upon execution of a written engagement agreement. Information provided before that point is treated as confidential.
              </p>
            </div>

            <button
              onClick={() => { setAgreed(a => !a); setErrors(e => ({ ...e, agreed: '' })); }}
              className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all mt-2 ${
                agreed
                  ? 'bg-green-500/10 border-green-500/30'
                  : errors.agreed
                  ? 'bg-red-500/8 border-red-500/30'
                  : 'bg-slate-800 border-slate-600 hover:border-slate-500'
              }`}
            >
              {agreed
                ? <CheckSquare size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
                : <Square size={18} className="text-slate-400 flex-shrink-0 mt-0.5" />
              }
              <p className={`text-sm font-medium leading-snug ${agreed ? 'text-green-300' : 'text-slate-300'}`}>
                I have read and agree to the disclosures above. I consent to be contacted by Bradford Law LLC and understand that all documents must be submitted electronically.
              </p>
            </button>
            {errors.agreed && (
              <p className="text-red-400 text-xs flex items-center gap-1.5">
                <AlertCircle size={12} /> {errors.agreed}
              </p>
            )}
          </div>

          <button
            onClick={handleStart}
            disabled={loading || !agreed}
            className="mt-5 w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-900 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-base"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
            ) : (
              <>
                Register &amp; Begin Intake Form
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          Attorney-client privilege attaches upon consultation. Not legal advice.
        </p>
      </div>
    </div>
  );
}
