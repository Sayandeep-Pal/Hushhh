import { motion } from 'framer-motion';
import { Lock, EyeOff, ShieldCheck, Zap, Database, Terminal } from 'lucide-react';

interface TechStepProps {
  number: string;
  title: string;
  description: string;
  screenshot: string;
  icon: typeof Lock;
  isLast?: boolean;
}

const TechStep = ({ number, title, description, screenshot, icon: Icon, isLast = false }: TechStepProps) => (
  <div className="relative pb-24 md:pb-32 last:pb-0">
    {!isLast && <div className="absolute left-[19px] top-12 bottom-0 w-[1px] bg-white/5 hidden md:block" />}
    
    <div className="flex flex-col md:flex-row gap-12 md:gap-20 items-start">
      <div className="flex-shrink-0 relative z-10">
        <div className="w-10 h-10 border border-white/10 bg-surface flex items-center justify-center font-mono text-xs text-primary shadow-[0_0_15px_rgba(187,195,255,0.1)] rounded-sm">
          {number}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-12 items-center">
        <div className="flex-1 max-w-xl">
          <div className="flex items-center gap-3 mb-6 text-secondary">
            <Icon size={16} strokeWidth={1.5} />
            <span className="font-mono text-[9px] tracking-[0.3em] uppercase">Phase_{number} // Data_Node</span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-black mb-6 uppercase italic tracking-tighter">{title}</h2>
          <p className="text-text-secondary text-base leading-relaxed font-light mb-8">
            {description}
          </p>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="w-full max-w-[320px] relative group shrink-0"
        >
          {/* Viewfinder Corners */}
          <div className="absolute -top-2 -left-2 w-4 h-4 border-t border-l border-primary/30" />
          <div className="absolute -top-2 -right-2 w-4 h-4 border-t border-r border-primary/30" />
          <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b border-l border-primary/30" />
          <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b border-r border-primary/30" />
          
          <div className="border border-white/10 bg-surface overflow-hidden shadow-2xl relative z-10 aspect-[9/19] rounded-sm">
            <img src={screenshot} alt={title} className="w-full h-full object-cover grayscale opacity-70 group-hover:grayscale-0 transition-all duration-700 group-hover:opacity-100" />
            <div className="absolute bottom-0 left-0 w-full p-3 bg-background/90 backdrop-blur-sm border-t border-white/5 flex justify-between items-center">
              <span className="font-mono text-[7px] text-text-secondary tracking-widest uppercase">Verified.img_{number}</span>
              <div className="w-1 h-1 bg-secondary rounded-full animate-pulse" />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </div>
);

export default function Overview() {
  return (
    <div className="min-h-screen bg-background pt-32 pb-40 px-6 overflow-x-hidden relative">
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      
      <div className="container mx-auto max-w-6xl">
        <header className="mb-24 md:mb-32 max-w-3xl">
          <div className="flex items-center gap-4 mb-8 font-mono text-[10px] tracking-[0.4em] text-primary uppercase">
            <Terminal size={14} />
            Hushhh Documentation
          </div>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-black uppercase italic leading-[0.85] tracking-tighter mb-10">
            How it <br /> <span className="text-primary">Works.</span>
          </h1>
          <p className="text-lg md:text-xl text-text-secondary leading-relaxed font-light">
            Hushhh is an encrypted-chat prototype with a zero-width visual-obfuscation layer. Its security architecture is being rebuilt before public release.
          </p>
        </header>

        <div className="space-y-12">
          <TechStep 
            number="01"
            icon={Lock}
            title="Cold Entry."
            description="Hushhh creates a pseudonymous device-held identity without requiring a phone number or email. It does not promise anonymity or untraceability."
            screenshot="/screenshots/splash&identity.jpg"
          />

          <TechStep 
            number="02"
            icon={ShieldCheck}
            title="The Handshake."
            description="Security starts with an out-of-band Secret Code. It is never included in an invite link. The app uses a per-conversation salt and a strengthened local derivation step while a reviewed protocol migration is underway."
            screenshot="/screenshots/handshake req.jpg"
          />

          <TechStep 
            number="03"
            icon={EyeOff}
            title="Stealth Encoding."
            description="When you send a message, an authenticated encrypted envelope can be mapped to zero-width Unicode characters. This is visual obfuscation, not a claim to hide metadata or defeat analysis."
            screenshot="/screenshots/stealth mode.jpg"
          />

          <TechStep 
            number="04"
            icon={Zap}
            title="Carrier Delivery."
            description="The invisible payload is attached to a randomly selected carrier icon. The server still processes encrypted payloads and operational metadata such as timing and conversation membership."
            screenshot="/screenshots/secure chat room.jpg"
          />

          <TechStep 
            number="05"
            icon={Database}
            title="The Vault."
            description="Vault and app-lock behavior are under active revision. Do not rely on this prototype to protect sensitive key material on a compromised or unattended device."
            screenshot="/screenshots/settings and vault.jpg"
            isLast={true}
          />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="mt-40 border border-white/5 bg-surface/30 p-12 md:p-24 text-center relative overflow-hidden rounded-md"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-primary/20" />
          <h3 className="font-display text-4xl md:text-6xl font-black uppercase italic mb-8">Ready for <br /> Silence?</h3>
          <a 
            href="/Hushhh.apk" 
            download
            className="inline-flex h-14 md:h-20 px-8 md:px-16 bg-white text-background font-mono text-xs md:text-sm tracking-[0.3em] font-black uppercase hover:bg-primary-container hover:text-white transition-all shadow-2xl items-center justify-center rounded-md"
          >
            Download.APK
          </a>
        </motion.div>
      </div>
    </div>
  );
}
