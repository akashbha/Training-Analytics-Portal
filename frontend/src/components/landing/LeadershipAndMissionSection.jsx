import React from "react";
import { useRevealOnScroll } from "./useRevealOnScroll.js";
import teamCollaborationImg from "../../assets/team-collaboration.jpg";
import mentorReviewImg from "../../assets/mentor-review.jpg";
import leaderDirectorImg from "../../assets/leader-director.jpg";
import leaderArchitectImg from "../../assets/leader-architect.jpg";
import leaderTrainerImg from "../../assets/leader-trainer.jpg";
import leaderDesignerImg from "../../assets/leader-designer.jpg";
import { ShieldCheck, HeartHandshake, Zap, Target } from "lucide-react";

const MISSION_PILLARS = [
  {
    title: "Automate the Repetitive",
    desc: "Automate repetitive logging like drill scores, timing, and error categorizations so trainers focus on instruction.",
    Icon: Zap,
  },
  {
    title: "Boost Trainee Potential",
    desc: "Free mentors from routine grading to focus on 1:1 problem solving, code reviews, and architectural reasoning.",
    Icon: Target,
  },
  {
    title: "Ensure 24/7 Reliability",
    desc: "Provide nonstop telemetry so every submission is captured, validated, and categorized with zero downtime.",
    Icon: ShieldCheck,
  },
  {
    title: "Drive Smarter Mastery",
    desc: "Increase cohort passing velocity and eliminate recurring skill gaps with closed-loop remediation drills.",
    Icon: HeartHandshake,
  },
];

const LEADERSHIP_TEAM = [
  {
    name: "Dr. Aris Thorne",
    role: "Founder & Academic Director",
    desc: "Visionary engineering leader shaping the future of technical cohort education and objective assessment.",
    img: leaderDirectorImg,
  },
  {
    name: "Dr. Elena Rostova",
    role: "CTO & AI Systems Architect",
    desc: "Building intelligent diagnostic pipelines and high-throughput real-time WebSocket telemetry.",
    img: leaderArchitectImg,
  },
  {
    name: "Marcus Vance",
    role: "Principal Trainer & Viva Lead",
    desc: "Decades of distributed systems experience, coaching mentors and formulating rigorous evaluation rubrics.",
    img: leaderTrainerImg,
  },
  {
    name: "Priya Patel",
    role: "Lead Learning Experience Designer",
    desc: "Designing seamless, role-tailored user interfaces for engineering trainees, trainers, and admins.",
    img: leaderDesignerImg,
  },
];

export function LeadershipAndMissionSection() {
  const [missionRef, missionVisible] = useRevealOnScroll();
  const [valuesRef, valuesVisible] = useRevealOnScroll();
  const [visionRef, visionVisible] = useRevealOnScroll();
  const [teamRef, teamVisible] = useRevealOnScroll();

  return (
    <section className="bg-[#FAF8F5] py-20 sm:py-28 px-6 sm:px-10 border-b border-black/[0.05] space-y-24 sm:space-y-32">
      {/* =========================================================================
          1. OUR MISSION (Matching Video Frame 026)
          ========================================================================= */}
      <div
        id="our-mission"
        ref={missionRef}
        className={`tiq-reveal ${missionVisible ? "tiq-revealed" : ""} max-w-6xl mx-auto space-y-12`}
      >
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block px-3 py-1 rounded bg-[#EAE7E1] text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C5549] mb-3">
            OUR MISSION
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.6rem] font-semibold tracking-tight text-[#1C1B17] leading-tight">
            Freeing Instructional Teams from Routine Grading
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-[#787063]">
            We remove administrative friction with verified analytics so engineering mentors can focus on mentorship and growth.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {MISSION_PILLARS.map(({ title, desc, Icon }) => (
            <div
              key={title}
              className="rounded-3xl bg-white p-6 sm:p-7 border border-black/[0.05] shadow-xs hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between min-h-[220px]"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#F6F4EF] flex items-center justify-center text-[#E45826] mb-5">
                <Icon className="w-5 h-5" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-extrabold text-[#1C1B17]">{title}</h3>
                <p className="text-[11px] text-[#5C5549] leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* =========================================================================
          2. OUR VALUES WITH REAL TEAM COLLABORATION PHOTOGRAPHY (Frame 029)
          ========================================================================= */}
      <div
        id="our-values"
        ref={valuesRef}
        className={`tiq-reveal ${valuesVisible ? "tiq-revealed" : ""} max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center`}
      >
        <div className="lg:col-span-6 space-y-6">
          <span className="inline-block px-3 py-1 rounded bg-[#EAE7E1] text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C5549]">
            OUR VALUES
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#1C1B17] leading-tight">
            Built on Rigor, Driven by Innovation
          </h2>
          <p className="text-xs sm:text-sm text-[#5C5549] leading-relaxed">
            At TraineeIQ, our values guide everything we build and deliver. From reliability to innovation, each
            principle reflects our promise to make technical education smarter, faster, and more human-centered.
          </p>

          <div className="rounded-2xl bg-white border border-black/[0.06] divide-y divide-black/[0.06] shadow-sm">
            <div className="p-4 sm:p-5">
              <h4 className="text-xs font-bold text-[#1C1B17]">Operational Reliability</h4>
              <p className="text-[11px] text-[#5C5549] mt-1">
                Reliable analytics services that ensure smooth cohort evaluations, persistent ledgers, and zero data loss every single day.
              </p>
            </div>
            <div className="p-4 sm:p-5">
              <h4 className="text-xs font-bold text-[#1C1B17]">Human-AI Partnership</h4>
              <p className="text-[11px] text-[#5C5549] mt-1">
                AI and machine learning do not replace mentors—they empower them with early warning signals to teach with clarity.
              </p>
            </div>
            <div className="p-4 sm:p-5">
              <h4 className="text-xs font-bold text-[#1C1B17]">Instructional Efficiency</h4>
              <p className="text-[11px] text-[#5C5549] mt-1">
                Smarter workflows that reduce manual spreadsheet calculations, speed up feedback, and elevate trainee pass rates.
              </p>
            </div>
          </div>
        </div>

        {/* Real Team Photography (Matching Video Frame 029) */}
        <div className="lg:col-span-6">
          <div className="rounded-3xl overflow-hidden shadow-2xl border border-black/[0.06] relative group">
            <img
              src={teamCollaborationImg}
              alt="Diverse software engineering team collaborating at wooden conference table"
              className="w-full h-[400px] sm:h-[460px] object-cover group-hover:scale-102 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-white/90 backdrop-blur-md border border-white/40 text-xs font-bold text-[#1C1B17] shadow-lg flex items-center justify-between">
              <span>Engineering Cohort In-Person Review</span>
              <span className="text-[10px] text-[#E45826] uppercase">Active Batch 2026</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. OUR VISION WITH MENTORS REVIEWING SCREEN PHOTOGRAPHY (Frame 030)
          ========================================================================= */}
      <div
        id="our-vision"
        ref={visionRef}
        className={`tiq-reveal ${visionVisible ? "tiq-revealed" : ""} max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center`}
      >
        {/* Real Mentors Reviewing Screen Photography (Matching Video Frame 030) */}
        <div className="lg:col-span-6 order-2 lg:order-1">
          <div className="rounded-3xl overflow-hidden shadow-2xl border border-black/[0.06] relative group">
            <img
              src={mentorReviewImg}
              alt="Senior software mentors reviewing telemetry dashboard on laptop screen"
              className="w-full h-[380px] sm:h-[440px] object-cover group-hover:scale-102 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-white/90 backdrop-blur-md border border-white/40 text-xs font-bold text-[#1C1B17] shadow-lg flex items-center justify-between">
              <span>Technical Mentors Diagnostic Review</span>
              <span className="text-[10px] text-emerald-600 uppercase font-extrabold">98.4% Accuracy</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 order-1 lg:order-2 space-y-6">
          <span className="inline-block px-3 py-1 rounded bg-[#EAE7E1] text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C5549]">
            OUR VISION
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#1C1B17] leading-tight">
            Role-Guarded Engineering Excellence Without Limits
          </h2>
          <p className="text-xs sm:text-sm text-[#5C5549] leading-relaxed">
            We envision an engineering training ecosystem where every cohort is augmented with live telemetry,
            ensuring instructional operations run 24/7 with zero delays, no missed misconceptions, and maximum student mastery.
          </p>
          <div className="p-5 rounded-2xl bg-[#FAF0E6] border border-[#F3DFC9] space-y-2">
            <h4 className="text-xs font-bold text-[#A26229]">Objective Diagnostic Transparency</h4>
            <p className="text-[11px] text-[#5C5549] leading-relaxed">
              By replacing arbitrary subjective grades with verifiable rubric criteria and real-time error ledgers,
              we restore trust between trainees, instructors, and hiring organizations.
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. OUR TEAM WITH 4 PORTRAIT PHOTOGRAPHY CARDS (Frame 032)
          ========================================================================= */}
      <div
        id="our-team"
        ref={teamRef}
        className={`tiq-reveal ${teamVisible ? "tiq-revealed" : ""} max-w-6xl mx-auto space-y-12`}
      >
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block px-3 py-1 rounded bg-[#EAE7E1] text-[10px] font-bold uppercase tracking-[0.14em] text-[#5C5549] mb-3">
            OUR TEAM
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#1C1B17] leading-tight">
            People and Technology, Building Engineers Together
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-[#787063]">
            We&apos;re a global team of engineers, mentors, and curriculum researchers united by one goal: simplifying technical training with verifiable analytics.
          </p>
        </div>

        {/* 4 Portrait Cards (Exact Replica of Frame 032) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {LEADERSHIP_TEAM.map((member) => (
            <div
              key={member.name}
              className="rounded-3xl bg-white border border-black/[0.05] overflow-hidden shadow-xs hover:-translate-y-1.5 transition-all duration-300 group flex flex-col justify-between"
            >
              {/* Portrait Photo Container */}
              <div className="relative h-[280px] overflow-hidden bg-slate-100">
                <img
                  src={member.img}
                  alt={member.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-[9px] font-extrabold uppercase tracking-wider text-[#1C1B17] shadow-xs">
                  {member.role.split("&")[0].trim()}
                </div>
              </div>

              {/* Text Info */}
              <div className="p-5 space-y-1.5">
                <h3 className="text-base font-extrabold text-[#1C1B17] tracking-tight">{member.name}</h3>
                <div className="text-[11px] font-semibold text-[#E45826]">{member.role}</div>
                <p className="text-[11px] text-[#5C5549] mt-2 leading-relaxed">{member.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default LeadershipAndMissionSection;
