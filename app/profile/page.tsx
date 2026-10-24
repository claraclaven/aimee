"use client";

import { useEffect, useState } from "react";
import { Save, Sparkles, Trash2, CheckCircle2 } from "lucide-react";
import { clientStore } from "@/lib/client-store";
import type { MemoryRecord, StudentProfile } from "@/lib/types";

const SAMPLE_CV = `John Doe — Final-year Computer Science student

Summary
- Passionate about distributed systems and TypeScript.

Experience
- Built a real-time chat app with Node.js and WebSockets.
- Interned on a payments team using PostgreSQL and REST APIs.
- Created a React dashboard for IoT sensor data.

Projects
- Raft consensus implementation in Go (distributed systems coursework).
- Machine learning model for image classification with Python and PyTorch.

Skills
- TypeScript, React, Python, Node.js, SQL, Docker`;

export default function ProfilePage() {
  const [profile, setProfile] = useState<StudentProfile>({
    name: "John Doe",
    targetRole: "Software Engineer",
    stack: ["TypeScript", "React", "Python"],
    gpa: "3.8",
    location: "Remote",
    ambition: "Build large-scale distributed systems",
    baseCv: SAMPLE_CV,
  });
  const [stackText, setStackText] = useState("TypeScript, React, Python");
  const [mined, setMined] = useState<MemoryRecord[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const cv = clientStore.getBaseCv();
    if (cv) setProfile((p) => ({ ...p, baseCv: cv }));
  }, []);

  async function save() {
    setSaving(true);
    const finalProfile: StudentProfile = {
      ...profile,
      stack: stackText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    clientStore.setBaseCv(finalProfile.baseCv);
    const res = await fetch("/api/hmem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mineProfile", profile: finalProfile }),
    });
    const data = await res.json();
    setMined(data.created ?? []);
    setSaving(false);
  }

  async function reset() {
    await fetch("/api/hmem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    setMined([]);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Profile & CV Studio</h1>
        <p className="text-sm text-gray-400">
          Enter your details and base CV. Saving mines structured facts into the
          H-MEM memory graph and hashes them into the trust ledger.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Target role</label>
              <input
                className="input"
                value={profile.targetRole}
                onChange={(e) =>
                  setProfile({ ...profile, targetRole: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">GPA</label>
              <input
                className="input"
                value={profile.gpa}
                onChange={(e) =>
                  setProfile({ ...profile, gpa: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Location preference</label>
              <input
                className="input"
                value={profile.location}
                onChange={(e) =>
                  setProfile({ ...profile, location: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <label className="label">Preferred stack (comma-separated)</label>
            <input
              className="input"
              value={stackText}
              onChange={(e) => setStackText(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Career ambition</label>
            <input
              className="input"
              value={profile.ambition}
              onChange={(e) =>
                setProfile({ ...profile, ambition: e.target.value })
              }
            />
          </div>

          <div>
            <label className="label">Base CV</label>
            <textarea
              className="input h-56 resize-y font-mono text-xs"
              value={profile.baseCv}
              onChange={(e) =>
                setProfile({ ...profile, baseCv: e.target.value })
              }
            />
          </div>

          <div className="flex gap-3">
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? (
                "Mining…"
              ) : (
                <>
                  <Save size={15} /> Save to H-MEM
                </>
              )}
            </button>
            <button className="btn-danger" onClick={reset}>
              <Trash2 size={15} /> Reset memory
            </button>
          </div>
        </div>

        <div className="card space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-300">
            <Sparkles size={15} className="text-neon-cyan" /> Mined Memory
            Records
          </h2>
          {mined == null && (
            <p className="text-sm text-gray-500">
              Save your profile to see the extracted facts here.
            </p>
          )}
          {mined && mined.length === 0 && (
            <p className="text-sm text-gray-500">Memory cleared.</p>
          )}
          <ul className="space-y-2">
            {mined?.map((r) => (
              <li
                key={r.id}
                className="flex items-start gap-2 rounded-xl border border-white/5 bg-panel2 p-3"
              >
                <CheckCircle2
                  size={15}
                  className="mt-0.5 shrink-0 text-neon-green"
                />
                <div>
                  <span className="mr-2 text-[11px] font-semibold uppercase text-neon-cyan">
                    {r.kind}
                  </span>
                  <span className="text-sm text-gray-200">{r.content}</span>
                  <span className="ml-2 font-mono text-[10px] text-gray-500">
                    trust {r.trust.toFixed(2)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
