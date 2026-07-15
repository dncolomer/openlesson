"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
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
  const { t } = useI18n();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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

  const navLinks = [
    { href: "/pricing", label: "Upgrade" },
    { href: "/dashboard", label: t('nav.dashboard') },
  ];

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
              name={t("nav.openLesson")}
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
