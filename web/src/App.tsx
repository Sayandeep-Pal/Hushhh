import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Lock, EyeOff, Shield, ShieldAlert, Cpu, Share2, ArrowRight, Menu, X } from 'lucide-react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Overview from './pages/Overview';
import Beams from './components/Beams';

const TerminalLabel = ({ children, status = false, className = "" }: { children: string, status?: boolean, className?: string }) => (
  <div className={`flex items-center gap-2 font-mono text-[9px] md:text-[10px] tracking-[0.2em] text-text-secondary uppercase ${className}`}>
    {status && <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse shadow-[0_0_8px_#BDF4FF]" />}
    {children}
  </div>
);

const ScreenShot = ({ src, label, delay = 0, className = "" }: { src: string, label: string, delay?: number, className?: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 15 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.8, delay }}
    className={`group relative ${className}`}
  >
    <div className="aspect-[9/19] bg-surface border border-border/50 overflow-hidden transition-all duration-500 group-hover:border-primary/40 shadow-xl rounded-sm">
      <img src={src} alt={label} className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-transparent to-transparent pointer-events-none" />
    </div>
    <div className="mt-3 md:mt-4 flex justify-between items-center px-1">
      <span className="font-mono text-[8px] md:text-[9px] text-text-secondary tracking-[0.2em] uppercase">{label}</span>
      <div className="h-[1px] flex-1 mx-3 md:mx-4 bg-border/30" />
      <div className="w-1 h-1 bg-primary/20" />
    </div>
  </motion.div>
);

function LandingPage() {
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 120);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Hero Section - Refined for better spacing and balance */}
      <section className="container mx-auto px-6 pt-20 pb-24 md:pt-20 md:pb-40 lg:pt-10">
        <div className="grid lg:grid-cols-2 gap-20 lg:gap-32 items-center">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <TerminalLabel status className="mb-6">Channel: Encrypted // Visibility: Ghost</TerminalLabel>
              <h1 className={`font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black mb-8 tracking-tighter leading-[0.85] italic transition-all duration-100 ${glitch ? 'skew-x-2 translate-x-1 opacity-90' : ''}`}>
                THE APP <br /> THAT DOESN'T <br /> 
                <span className="text-primary drop-shadow-[0_0_15px_rgba(187,195,255,0.2)]">EXIST.</span>
              </h1>
              <p className="text-lg md:text-xl text-text-secondary leading-relaxed font-light mb-12 max-w-lg">
                Total steganographic E2EE. No metadata. No identity leaks. <br className="hidden sm:block" />
                <span className="text-text-primary">Designed for absolute silence.</span>
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <a 
                  href="/Hushhh.apk"
                  download
                  className="h-14 md:h-16 px-6 md:px-10 bg-primary-container text-white font-mono text-xs tracking-[0.3em] font-black flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all group shadow-xl shadow-primary/10 rounded-md"
                >
                  INITIALIZE DOWNLOAD
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </a>
                <Link to="/overview" className="h-14 md:h-16 sm:w-64 border border-border px-6 md:px-8 flex items-center justify-center gap-4 group hover:bg-white/5 transition-colors cursor-pointer backdrop-blur-sm rounded-md">
                  <div className="w-2 h-2 bg-secondary/30 rounded-full group-hover:bg-secondary shadow-[0_0_8px_rgba(189,244,255,0.2)]" />
                  <span className="font-mono text-[10px] tracking-[0.2em] text-text-secondary uppercase">View Protocol</span>
                </Link>
              </div>
            </motion.div>
          </div>

          <div className="relative mt-12 lg:mt-0">
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:gap-8 scale-90 sm:scale-100">
              <ScreenShot src="/screenshots/secure chat room.jpg" label="INTERFACE_V2.0" />
              <div className="pt-16 sm:pt-24 lg:pt-32">
                <ScreenShot src="/screenshots/stealth mode.jpg" label="STEALTH_ACTIVE" delay={0.2} />
              </div>
            </div>
            <div className="absolute -top-6 -left-6 w-32 h-32 border-t border-l border-white/5 hidden sm:block pointer-events-none" />
            <div className="absolute -bottom-6 -right-6 w-32 h-32 border-b border-r border-white/5 hidden sm:block pointer-events-none" />
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="protocol" className="border-y border-white/5 bg-surface/30 relative">
        <div className="container mx-auto px-6 py-24 md:py-40">
          <div className="mb-20 md:mb-32 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-12">
            <div className="max-w-xl">
              <TerminalLabel status className="mb-6">Protocol_Infrastructure_091</TerminalLabel>
              <h2 className="font-display text-5xl md:text-7xl lg:text-8xl font-black uppercase leading-[0.85] tracking-tighter italic">Redacted <br /> Architecture.</h2>
            </div>
            <div className="font-mono text-[10px] md:text-xs text-text-secondary text-left space-y-3 uppercase tracking-[0.2em] leading-relaxed border-l-2 border-primary/20 pl-6 md:pl-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full" />
                AES-256-CBC STANDARD
              </div>
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full" />
                STEGANOGRAPHY V4.0
              </div>
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full" />
                LOG_CLEARANCE: TOTAL
              </div>
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full" />
                IDENTITY: VOLATILE
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16 md:gap-y-24">
            {[
              { icon: EyeOff, t: "Zero-Width Stealth", d: "Payloads are hidden in invisible Unicode whitespace. Even shoulder-surfers see nothing but carrier icons." },
              { icon: Lock, t: "Cold Derivation", d: "PBKDF2 keys derived locally with 1000+ iterations. Your secrets never leave the secure hardware store." },
              { icon: Cpu, t: "Local Handshake", d: "Discovery is purely decentralized. Connect via cryptographic deep links or secure QR codes." },
              { icon: ShieldAlert, t: "Auto-Lock Timers", d: "Self-destructing decryption sessions. Access expires automatically based on your defined threat level." },
              { icon: Shield, t: "Biometric Vault", d: "Keys are gated by OS-level biometrics and secured by the device Secure Enclave." },
              { icon: Share2, t: "Ghost Identities", d: "Create unlimited burner accounts with zero PII. No phone, no email, no trace." }
            ].map((f, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="group"
              >
                <div className="flex items-center gap-4 mb-6 md:mb-8">
                  <div className="w-14 h-14 border border-white/5 flex items-center justify-center text-text-secondary group-hover:text-primary group-hover:border-primary/40 group-hover:bg-primary/5 transition-all duration-500">
                    <f.icon size={24} strokeWidth={1} />
                  </div>
                  <div className="h-[1px] flex-1 bg-white/5" />
                </div>
                <h3 className="font-display text-xl md:text-2xl font-bold uppercase mb-4 tracking-tight group-hover:text-primary transition-colors">{f.t}</h3>
                <p className="text-text-secondary text-sm md:text-base leading-relaxed font-light">{f.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* The Moment Section - Consistent Typography */}
      <section id="security" className="container mx-auto px-6 py-32 md:py-48">
        <div className="max-w-5xl mx-auto border border-white/5 bg-surface/20 p-8 sm:p-16 md:p-24 relative overflow-hidden group backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-[60%] h-[100%] bg-primary/5 -skew-x-12 translate-x-1/3 pointer-events-none transition-transform duration-700 group-hover:translate-x-1/4" />
          <div className="relative z-10 text-center sm:text-left">
            <TerminalLabel status className="justify-center sm:justify-start">Security_Authorization_Required</TerminalLabel>
            <h2 className="font-display text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-black mt-10 mb-10 uppercase tracking-tighter italic leading-[0.85]">Crack the <br /> <span className="text-primary drop-shadow-[0_0_20px_rgba(187,195,255,0.3)] transition-all group-hover:drop-shadow-[0_0_40px_rgba(187,195,255,0.4)]">Silence.</span></h2>
            <p className="text-text-secondary text-lg md:text-xl max-w-2xl font-light mb-16 leading-relaxed">
              Unlock your vault with a secret handshake. No cloud recovery. No backdoors. If you lose the code, the message is gone forever. <br className="hidden md:block" />
              <span className="text-text-primary mt-4 block font-medium">As it should be.</span>
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-10 lg:gap-16">
              <div className="flex gap-4 md:gap-6">
                {[1, 2, 3, 4].map(i => (
                  <motion.div 
                    key={i} 
                    animate={{ opacity: [0.2, 0.5, 0.2] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                    className="w-12 h-16 md:w-16 md:h-20 border border-primary/20 flex items-center justify-center font-mono text-3xl text-primary rounded-sm"
                  >
                    _
                  </motion.div>
                ))}
              </div>
              <button className="w-full sm:w-auto h-14 sm:h-20 px-8 sm:px-12 bg-white text-background font-mono text-xs md:text-sm tracking-[0.4em] font-black uppercase hover:bg-primary-container hover:text-white hover:scale-105 transition-all shadow-2xl rounded-md">
                INITIALIZE IDENTITY
              </button>
            </div>
          </div>
          
          {/* Redacted Decorative Element */}
          <div className="absolute bottom-6 right-6 sm:bottom-10 sm:left-10 md:left-20 text-left hidden sm:block">
            <div className="font-mono text-[8px] tracking-[0.3em] text-text-secondary mb-3 uppercase">Authorization_Token_Redacted</div>
            <div className="flex gap-2">
              <div className="w-32 md:w-48 h-2 md:h-3 bg-white/10" />
              <div className="w-16 h-2 md:h-3 bg-primary/20" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Layout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background text-text-primary selection:bg-primary selection:text-white relative overflow-x-hidden font-sans">
      <div className="scanline" />
      
      {/* Background Beams */}
      <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
        <Beams 
          beamWidth={2}
          beamHeight={20}
          beamNumber={15}
          lightColor="#BBC3FF"
          speed={1.5}
          noiseIntensity={2}
          scale={0.3}
          rotation={-15}
        />
      </div>

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full" />
      </div>


      {/* Navigation */}
      <nav className="fixed top-0 w-full z-[100] border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-6 h-16 md:h-20 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3">
            <img src="/icon.png" alt="Hushhh" className="w-6 h-6 md:w-8 md:h-8" />
            <span className="font-display text-base md:text-xl font-black tracking-tighter italic uppercase">HUSHHH</span>
          </Link>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-12">
            <Link to="/overview" className="font-mono text-[10px] tracking-[0.3em] text-text-secondary hover:text-primary transition-colors uppercase">Protocol</Link>
            <a href="#security" className="font-mono text-[10px] tracking-[0.3em] text-text-secondary hover:text-primary transition-colors uppercase">Security</a>
            <a 
              href="/Hushhh.apk" 
              download
              className="px-8 py-2.5 bg-primary-container text-white font-mono text-[10px] tracking-[0.2em] hover:bg-white hover:text-background transition-all uppercase shadow-lg shadow-primary/20 flex items-center justify-center rounded-sm"
            >
              Download.APK
            </a>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden w-10 h-10 flex items-center justify-end text-text-secondary hover:text-primary transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
          </button>
        </div>

        {/* Mobile Navigation Overlay */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-0 top-16 bg-background z-[90] md:hidden"
            >
              <div className="flex flex-col p-8 h-full border-t border-white/5">
                <div className="space-y-12">
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                    <Link 
                      to="/overview" 
                      className="block font-display text-5xl font-black uppercase italic tracking-tighter hover:text-primary"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Protocol
                    </Link>
                  </motion.div>
                  <motion.a 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    href="#security" 
                    className="block font-display text-5xl font-black uppercase italic tracking-tighter hover:text-primary"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Security
                  </motion.a>
                </div>
                
                <div className="mt-auto pb-12">
                  <div className="terminal-row mb-6 border-t border-white/5 pt-6">System Status: Established</div>
                  <motion.a 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    href="/Hushhh.apk"
                    download
                    className="w-full h-16 bg-primary text-white font-mono text-xs tracking-[0.4em] font-black uppercase shadow-2xl shadow-primary/30 flex items-center justify-center"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Download.APK
                  </motion.a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="relative z-10">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/overview" element={<Overview />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="py-16 md:py-24 border-t border-white/5 bg-background/50 relative z-10">
        <div className="container mx-auto px-6 flex flex-col items-center gap-12 text-center">
          <Link to="/" className="flex items-center gap-4 scale-110">
            <img src="/icon.png" alt="Hushhh" className="w-6 h-6" />
            <span className="font-display text-xl font-black tracking-tighter italic uppercase">HUSHHH</span>
          </Link>
          
          <div className="max-w-xl flex flex-col gap-6">
            <p className="font-mono text-[10px] md:text-xs tracking-[0.4em] text-text-secondary uppercase leading-relaxed">
              Encryption is not a crime. <br />
              Privacy is a human right. <br />
              Silence is the ultimate weapon.
            </p>
            <div className="h-[1px] w-12 bg-primary/40 mx-auto" />
          </div>

          <div className="flex flex-wrap justify-center gap-10 md:gap-16 font-mono text-[9px] md:text-[10px] tracking-[0.3em] uppercase text-text-secondary">
            <a href="#" className="hover:text-primary transition-colors">Source</a>
            <a href="#" className="hover:text-primary transition-colors">Manifesto</a>
            <a href="#" className="hover:text-primary transition-colors">Verify.txt</a>
            <a href="#" className="hover:text-primary transition-colors">Security</a>
          </div>

          <div className="flex flex-col items-center gap-6 mt-8">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-secondary rounded-full shadow-[0_0_8px_#BDF4FF]" />
              <span className="font-mono text-[9px] text-secondary tracking-[0.4em] uppercase">Protocol_Active // Secured</span>
            </div>
            <span className="font-mono text-[8px] text-text-secondary opacity-30 tracking-[0.5em] uppercase">
              [END_OF_TRANSMISSION_2026_EDITION]
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Layout />
    </Router>
  );
}

export default App;
