import { motion } from 'framer-motion';
import { Lock, EyeOff, ShieldCheck, Zap, Database, Terminal } from 'lucide-react';

const TechStep = ({ number, title, description, screenshot, icon: Icon, isLast = false }: any) => (
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
            Hushhh isn't just a messenger. It's a steganographic abstraction layer designed to make private communication indistinguishable from background noise.
          </p>
        </header>

        <div className="space-y-12">
          <TechStep 
            number="01"
            icon={Lock}
            title="Cold Entry."
            description="Unlike standard apps that require phone numbers or emails, Hushhh creates a unique cryptographic identity on your device. Every identity is isolated, anonymous, and untraceable."
            screenshot="/screenshots/splash&identity.jpg"
          />

          <TechStep 
            number="02"
            icon={ShieldCheck}
            title="The Handshake."
            description="Security starts with the Secret Code. You and your contact enter a matching code locally. Hushhh uses PBKDF2 with 1000+ iterations to derive a shared 256-bit AES key. This key never travels through any server."
            screenshot="/screenshots/handshake req.jpg"
          />

          <TechStep 
            number="03"
            icon={EyeOff}
            title="Stealth Encoding."
            description="When you send a message, it is encrypted via AES-256-CBC. The resulting ciphertext is then mapped to zero-width Unicode characters. These characters are completely invisible to humans and most scanning software."
            screenshot="/screenshots/stealth mode.jpg"
          />

          <TechStep 
            number="04"
            icon={Zap}
            title="Carrier Delivery."
            description="The invisible payload is attached to a randomly selected 'Carrier Icon'. On the screen and on the server, only this icon is visible. To the world, you're just sending a kaomoji. To your contact, it's a secure data packet."
            screenshot="/screenshots/secure chat room.jpg"
          />

          <TechStep 
            number="05"
            icon={Database}
            title="The Vault."
            description="All your secret codes are stored in an OS-level secure vault, protected by your device biometrics. You can set auto-lock timers to wipe decrypted states from memory automatically."
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
