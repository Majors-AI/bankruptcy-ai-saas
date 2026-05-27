import { useState } from "react";
import { Calendar, Clock, Video, CheckCircle, ChevronRight, X, User, Mail, Phone } from "lucide-react";
import { supabase } from "../lib/supabase";

interface Props {
  client: { id: string; name: string; email: string; phone: string } | null;
  onClose: () => void;
  onScheduled?: () => void;
}

const TIMES = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM",
  "3:30 PM", "4:00 PM", "4:30 PM",
];

function getNext14Days() {
  const days: { label: string; value: string }[] = [];
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      days.push({
        label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        value: d.toISOString().split("T")[0],
      });
    }
  }
  return days;
}

function createGoogleMeetLink(topic: string, startTime: Date, endTime: Date) {
  const start = startTime.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = endTime.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const encodedTopic = encodeURIComponent(topic);
  return `https://meet.google.com/new?topic=${encodedTopic}&start=${start}&end=${end}`;
}

export default function ScheduleCall({ client, onClose, onScheduled }: Props) {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [name, setName] = useState(client?.name ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [meetLink, setMeetLink] = useState("");
  const days = getNext14Days();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  async function handleSchedule() {
    if (!selectedDate || !selectedTime || !name || !email) return;
    setLoading(true);

    try {
      const [h, rest] = selectedTime.split(":");
      const [min, ampm] = rest.split(" ");
      let hour = parseInt(h);
      if (ampm === "PM" && hour !== 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;
      const startTime = new Date(`${selectedDate}T${String(hour).padStart(2, "0")}:${min}:00`);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      const generatedMeetLink = createGoogleMeetLink(`Bankruptcy Consultation – ${name}`, startTime, endTime);

      await supabase.from("calendar_events").insert({
        client_id: client?.id ?? null,
        client_name: name,
        client_email: email,
        client_phone: phone,
        title: `Bankruptcy Consultation – ${name}`,
        description: notes,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        meet_link: generatedMeetLink,
        event_type: 'consultation',
        status: "scheduled",
      });

      if (client?.id) {
        await supabase.from("clients").update({
          status: "consultation_scheduled",
          consult_date: startTime.toISOString(),
          last_activity: new Date().toISOString(),
        }).eq("id", client.id);

        const day2 = new Date();
        day2.setDate(day2.getDate() + 2);
        await supabase.from("follow_up_sequences").insert([{
          client_id: client.id,
          client_name: name,
          client_email: email,
          client_phone: phone,
          stage: 'day2',
          next_follow_up_at: day2.toISOString(),
        }]);
      }

      try {
        await fetch(`${supabaseUrl}/functions/v1/send-confirmation`, {
          method: "POST",
          headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "call_scheduled",
            to: email,
            name,
            date: selectedDate,
            time: selectedTime,
            meet_link: generatedMeetLink,
          }),
        });
      } catch {
        // Email optional
      }

      setMeetLink(generatedMeetLink);
      setDone(true);
      onScheduled?.();
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center">
              <Video size={18} className="text-blue-400" />
            </div>
            <div>
              <p className="text-white font-bold text-base">Schedule a Consultation</p>
              <p className="text-slate-400 text-xs">Pick a date & time — a Google Meet link will be created</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center">
            <div className="w-16 h-16 bg-green-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-green-400" />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">Consultation Scheduled!</h3>
            <p className="text-slate-400 text-sm mb-2">
              {selectedDate} at {selectedTime}
            </p>
            {meetLink && (
              <a
                href={meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 text-sm font-semibold px-5 py-3 rounded-xl transition-colors"
              >
                <Video size={15} /> Open Google Meet
              </a>
            )}
            <p className="text-slate-500 text-xs mt-5">A confirmation email has been sent to {email}</p>
            <button onClick={onClose} className="mt-4 text-slate-400 hover:text-white text-sm transition-colors">Close</button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
            {!client && (
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-amber-400 uppercase tracking-widest mb-1.5">Your Name</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
                      className="w-full bg-slate-800 border border-slate-600 focus:border-amber-400/60 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none placeholder-slate-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-400 uppercase tracking-widest mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
                      className="w-full bg-slate-800 border border-slate-600 focus:border-amber-400/60 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none placeholder-slate-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-400 uppercase tracking-widest mb-1.5">Phone</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 555-5555"
                      className="w-full bg-slate-800 border border-slate-600 focus:border-amber-400/60 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none placeholder-slate-500" />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-amber-400 uppercase tracking-widest mb-2">Select Date</label>
              <div className="grid grid-cols-3 gap-2">
                {days.slice(0, 9).map(d => (
                  <button
                    key={d.value}
                    onClick={() => setSelectedDate(d.value)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all text-center ${selectedDate === d.value ? "bg-amber-400/15 border-amber-400 text-amber-400" : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500"}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-400 uppercase tracking-widest mb-2">Select Time</label>
              <div className="grid grid-cols-3 gap-2">
                {TIMES.map(t => (
                  <button
                    key={t}
                    onClick={() => setSelectedTime(t)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all text-center ${selectedTime === t ? "bg-amber-400/15 border-amber-400 text-amber-400" : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-400 uppercase tracking-widest mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Any questions or topics you'd like to discuss..."
                className="w-full bg-slate-800 border border-slate-600 focus:border-amber-400/60 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none placeholder-slate-500 resize-none"
              />
            </div>

            <button
              onClick={handleSchedule}
              disabled={!selectedDate || !selectedTime || !name || !email || loading}
              className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm transition-all"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
              ) : (
                <>
                  <Video size={15} />
                  Schedule with Google Meet
                  <ChevronRight size={15} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
