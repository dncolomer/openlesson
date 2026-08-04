"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface NavbarProps {
  breadcrumbs?: BreadcrumbItem[];
  showNav?: boolean;
}

export function Navbar({ breadcrumbs = [], showNav = true }: NavbarProps) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [mobileCommunityOpen, setMobileCommunityOpen] = useState(false);
  const { t } = useI18n();

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    router.push("/");
    router.refresh();
  };

  // Logged-in: product nav only (Upgrade + Dashboard). Community + Vision/Science for guests.
  const navLinks =
    isLoggedIn === true
      ? [
          { href: "/pricing", label: "Upgrade" },
          { href: "/dashboard", label: t("nav.dashboard") },
        ]
      : [
          { href: "/pricing", label: "Upgrade" },
          { href: "/dashboard", label: t("nav.dashboard") },
        ];

  const topLinks = [
    { href: "/vision", label: "Vision" },
    { href: "/science", label: "Science" },
  ];

  const communityLinks = [
    { href: "/all-you-can-learn", label: "All-You-Can-Learn" },
    { href: "/hackathons", label: "Hackathons" },
    { href: "/map-of-knowledge", label: "Map of Knowledge" },
    { href: "/tapbench", label: "TAPBench" },
  ];

  const showCommunity = isLoggedIn !== true;

  const solutionLinks = [
    { href: "/", label: t('nav.forIndividuals') },
    { href: "/enterprise", label: t('nav.forSales') },
    { href: "/for-hiring-teams", label: t('nav.forHR') },
    { href: "/homeschool", label: t('nav.forFamilies') },
    { href: "/schools", label: t('nav.forSchools') },
    { href: "/certify", label: t('nav.forCareers') },
    { href: "/agent", label: t('nav.forAIAgent') },
  ];

  return (
    <header className="border-b border-neutral-800/60 px-4 sm:px-6 py-4 backdrop-blur-sm bg-[#0a0a0a]/85 sticky top-0 z-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="transition hover:opacity-90">
            <BrandLogo
              name={t("nav.brandName")}
              nameClassName="text-base sm:text-lg font-semibold text-white tracking-tight"
            />
          </Link>
          
          {breadcrumbs.length > 0 && (
            <>
              <span className="text-neutral-600 hidden sm:inline">/</span>
              {breadcrumbs.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  {item.href ? (
                    <Link href={item.href} className="text-neutral-400 hover:text-white text-sm transition-colors">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-neutral-400 text-sm">{item.label}</span>
                  )}
                  {index < breadcrumbs.length - 1 && <span className="text-neutral-600 hidden sm:inline">/</span>}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Desktop Navigation */}
        {showNav && (
          <div className="hidden md:flex items-center gap-4">
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href} 
                className="text-xs sm:text-sm text-neutral-500 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}

            {showCommunity &&
              topLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs sm:text-sm text-neutral-500 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}

            {showCommunity && (
              <div
                className="relative"
                onMouseEnter={() => setCommunityOpen(true)}
                onMouseLeave={() => setCommunityOpen(false)}
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs sm:text-sm text-neutral-500 transition-colors hover:text-white"
                  aria-expanded={communityOpen}
                  aria-haspopup="menu"
                  onClick={() => setCommunityOpen((open) => !open)}
                >
                  Projects & Community
                  <svg
                    className={`h-3.5 w-3.5 transition-transform ${communityOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {communityOpen && (
                  <div
                    role="menu"
                    aria-label="Projects & Community"
                    className="absolute right-0 top-full z-50 mt-1 min-w-[11.5rem] border border-neutral-800 bg-[#0a0a0a]/95 py-1 shadow-xl shadow-black/40 backdrop-blur-md"
                  >
                    {communityLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        role="menuitem"
                        className="block px-3 py-2 text-xs text-neutral-400 transition-colors hover:bg-white/5 hover:text-white sm:text-sm"
                        onClick={() => setCommunityOpen(false)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            <LanguageSwitcher />
            
            {isLoggedIn === true ? (
              <button
                onClick={handleSignOut}
                className="text-xs sm:text-sm text-neutral-500 hover:text-white transition-colors"
              >
                {t('nav.signOut')}
              </button>
            ) : isLoggedIn === false && (
              <Link href="/login" className="px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm bg-neutral-800 hover:bg-neutral-700 text-white rounded-sm transition-colors">
                {t('nav.signIn')}
              </Link>
            )}
          </div>
        )}

        {/* Mobile Menu Button */}
        {showNav && (
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-neutral-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Mobile Menu Dropdown */}
      {showNav && mobileMenuOpen && (
        <div className="md:hidden mt-4 pb-4 border-t border-neutral-800 pt-4">
          <nav className="flex flex-col gap-4">
            {/* Solutions Section - visible only on mobile/tablet where SolutionsBand is hidden */}
            <div className="lg:hidden">
              <p className="text-xs text-neutral-600 uppercase tracking-wide mb-2">{t('nav.solutions')}</p>
              <div className="flex flex-col gap-2 pl-2 mb-4">
                {solutionLinks.map((link) => (
                  <Link 
                    key={link.href} 
                    href={link.href} 
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-sm text-neutral-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href} 
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm text-neutral-400 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}

            {showCommunity &&
              topLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}

            {showCommunity && (
              <div>
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left text-sm text-neutral-400 transition-colors hover:text-white"
                  aria-expanded={mobileCommunityOpen}
                  onClick={() => setMobileCommunityOpen((open) => !open)}
                >
                  Projects & Community
                  <svg
                    className={`h-4 w-4 transition-transform ${mobileCommunityOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {mobileCommunityOpen && (
                  <div className="mt-2 flex flex-col gap-2 border-l border-neutral-800 pl-3">
                    {communityLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-sm text-neutral-500 transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {isLoggedIn === true ? (
              <button
                onClick={() => {
                  handleSignOut();
                  setMobileMenuOpen(false);
                }}
                className="text-sm text-neutral-400 hover:text-white transition-colors text-left"
              >
                {t('nav.signOut')}
              </button>
            ) : isLoggedIn === false && (
              <Link 
                href="/login" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm text-neutral-400 hover:text-white transition-colors"
              >
                {t('nav.signIn')}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
