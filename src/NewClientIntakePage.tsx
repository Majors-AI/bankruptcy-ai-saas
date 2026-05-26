import { useState } from "react";
import NewClientRegistration from "./NewClientRegistration";
import FullBankruptcyQuestionnaire from "./FullBankruptcyQuestionnaire";
import ScheduleCall from "./ScheduleCall";

interface ClientInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
}

type Stage = "register" | "intake" | "schedule";

interface NewClientIntakePageProps {
  onBack?: () => void;
}

export default function NewClientIntakePage({ onBack }: NewClientIntakePageProps) {
  const [stage, setStage] = useState<Stage>("register");
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);

  function handleRegistered(info: ClientInfo) {
    setClient(info);
    setStage("intake");
  }

  function handleIntakeComplete() {
    setStage("schedule");
    setShowSchedule(true);
  }

  if (stage === "register") {
    return (
      <div className="min-h-screen bg-slate-950">
        {onBack && (
          <div className="fixed top-4 left-4 z-50">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-medium transition-colors bg-slate-900/80 border border-slate-700 px-3 py-2 rounded-xl backdrop-blur"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
              Back
            </button>
          </div>
        )}
        <NewClientRegistration onComplete={handleRegistered} />
      </div>
    );
  }

  if (stage === "intake" && client) {
    return (
      <FullBankruptcyQuestionnaire
        clientId={client.id}
        clientName={client.name}
        clientEmail={client.email}
        clientPhone={client.phone}
        staffMode={false}
      />
    );
  }

  if (stage === "schedule") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-xl text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-400/10 rounded-2xl border border-green-400/20 mb-6">
            <svg className="w-9 h-9 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Intake Submitted!</h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-8">
            Thank you, <strong className="text-white">{client?.name}</strong>. Your intake questionnaire has been received. Schedule a free consultation with one of our attorneys to review your case.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setShowSchedule(true)}
              className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-base"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              Schedule a Consultation
            </button>
            {onBack && (
              <button
                onClick={onBack}
                className="w-full border border-slate-600 text-slate-300 hover:border-slate-400 font-semibold py-3.5 rounded-xl transition-colors text-sm"
              >
                Return to Portal
              </button>
            )}
          </div>
        </div>
        {showSchedule && (
          <ScheduleCall
            client={client}
            onClose={() => setShowSchedule(false)}
            onScheduled={() => setShowSchedule(false)}
          />
        )}
      </div>
    );
  }

  return null;
}
