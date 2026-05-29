import { useState, useRef, useEffect } from 'react'
import { EyeIcon, EyeSlashIcon, ArrowRightIcon, ChevronDownIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'
import logoLightBrand from './assets/logo-light-brand.png';
import logoDarkBrand from './assets/logo-dark-brand.png';
import { useTheme } from 'strata-design-system';

const organizations = [
    { name: 'Strata Manufacturing HQ', users: 245, type: 'Primary workspace' },
    { name: 'Strata Sales Division', users: 120, type: 'Regional hub' },
    { name: 'Strata Logistics Link', users: 85, type: 'Distribution center' }
]

export default function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
    const [showPassword, setShowPassword] = useState(false)
    const [isRegistering, setIsRegistering] = useState(false)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [selectedOrg, setSelectedOrg] = useState(organizations[0])
    const dropdownRef = useRef<HTMLDivElement>(null)
    const { theme } = useTheme();

    const handleAction = () => {
        onLoginSuccess()
    }

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [])

    return (
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 font-sans bg-background transition-colors duration-300">
            {/* Left Side - Branding */}
            <div className="relative overflow-hidden flex flex-col justify-center p-12 lg:p-20 bg-sidebar text-sidebar-foreground transition-colors duration-300">
                {/* Decorative background element */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-sidebar-accent/50 to-sidebar/50 pointer-events-none" />

                <div className="relative z-10 max-w-lg space-y-8">
                    <div className="flex items-center gap-3 mb-12">
                        {/* Logo */}
                        <div className="mb-4">
                            <img src={logoLightBrand} alt="Strata" className="h-20 w-auto block dark:hidden" />
                            <img src={logoDarkBrand} alt="Strata" className="h-20 w-auto hidden dark:block" />
                        </div>
                    </div>

                    <h1 className="text-5xl font-brand font-bold leading-tight text-sidebar-foreground">
                        Transform your workflow with Strata
                    </h1>

                    <p className="text-sidebar-foreground/70 text-lg leading-relaxed">
                        At Strata, we provide comprehensive solutions for contract dealers and manufacturers, combining sales enablement, financial services, and expert consulting with cutting-edge technology to optimize operations and drive business growth.
                    </p>

                    <div className="flex gap-4 pt-4">
                        <button className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-full hover:opacity-90 transition-opacity flex items-center gap-2">
                            Talk to an Expert <ArrowRightIcon className="w-4 h-4" />
                        </button>
                        <button className="px-6 py-3 bg-transparent text-sidebar-foreground font-semibold rounded-full hover:bg-sidebar-accent transition-colors border border-sidebar-border">
                            Browse all Services
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex items-center justify-center p-8 relative overflow-hidden bg-[url('/login-bg.jpg')] bg-cover bg-center">
                {/* Dark Overlay */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

                <div className="w-full max-w-[440px] p-8 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl relative z-10 transition-all duration-300">
                    <div className="space-y-6">
                        <div className="space-y-2 text-center lg:text-left">
                            <h2 className="text-3xl font-bold text-white">
                                {isRegistering ? 'Create Account' : 'Welcome Back!'}
                            </h2>
                            <div className="flex flex-wrap gap-1 text-sm text-zinc-200 dark:text-zinc-300 justify-center lg:justify-start">
                                <span>{isRegistering ? 'Already have an account?' : "Don't have an account?"}</span>
                                <button
                                    onClick={() => {
                                        setIsRegistering(!isRegistering);
                                        // Reset state if desired, or keep consistent
                                    }}
                                    className="font-medium text-white hover:underline decoration-white/50 underline-offset-4"
                                >
                                    {isRegistering ? 'Login now' : 'Create a new account now,'}
                                </button>
                                {!isRegistering && <span>it's FREE! Takes less than a minute.</span>}
                            </div>
                        </div>

                        <div className="space-y-5">
                            {!isRegistering && (
                                <>
                                    <button className="w-full h-12 flex items-center justify-center gap-3 bg-white/10 border border-white/20 text-white rounded-xl hover:bg-white/20 transition-colors">
                                        <svg className="w-5 h-5" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg"><path fill="#f25022" d="M1 1h9v9H1z" /><path fill="#7fba00" d="M11 1h9v9h-9z" /><path fill="#00a4ef" d="M1 11h9v9H1z" /><path fill="#ffb900" d="M11 11h9v9h-9z" /></svg>
                                        Login with Microsoft
                                    </button>

                                    <div className="relative">
                                        <div className="absolute inset-0 flex items-center">
                                            <span className="w-full border-t border-white/20" />
                                        </div>
                                        <div className="relative flex justify-center text-xs uppercase">
                                            <span className="bg-transparent px-2 text-zinc-300 font-medium tracking-wider">Or login with email</span>
                                        </div>
                                    </div>
                                </>
                            )}

                            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleAction(); }}>
                                {isRegistering && (
                                    <div ref={dropdownRef}>
                                        <label className="text-zinc-200 dark:text-zinc-300 text-sm font-medium mb-1 block">Select Organization</label>
                                        <div className="relative group">
                                            <button
                                                type="button"
                                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                                className="w-full bg-white/10 border border-white/20 hover:bg-white/15 text-white rounded-xl p-3 flex items-center gap-3 transition-colors text-left"
                                            >
                                                <div className="h-10 w-10 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                                                    <BuildingOfficeIcon className="w-6 h-6 text-zinc-200" />
                                                </div>
                                                <div className="flex-1 overflow-hidden">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-sm truncate">{selectedOrg.name}</span>
                                                        <span className="h-2 w-2 rounded-full bg-green-500 shrink-0"></span>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground truncate">{selectedOrg.type} • {selectedOrg.users} users</div>
                                                </div>
                                                <ChevronDownIcon className={`w-5 h-5 text-muted-foreground transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            {isDropdownOpen && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                                                    {organizations.map((org, index) => (
                                                        <button
                                                            key={index}
                                                            type="button"
                                                            className={`w-full p-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors ${selectedOrg.name === org.name ? 'bg-white/5' : ''}`}
                                                            onClick={() => {
                                                                setSelectedOrg(org)
                                                                setIsDropdownOpen(false)
                                                            }}
                                                        >
                                                            <div className="h-8 w-8 bg-white/5 rounded-lg flex items-center justify-center shrink-0">
                                                                <BuildingOfficeIcon className="w-4 h-4 text-muted-foreground" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="font-medium text-sm text-white">{org.name}</div>
                                                                <div className="text-xs text-muted-foreground">{org.type}</div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="text-zinc-200 dark:text-zinc-300 text-sm font-medium mb-1 block">{isRegistering ? 'Work Email' : 'Email'}</label>
                                    <input
                                        name="email"
                                        type="email"
                                        defaultValue="hisalim.ux@gmail.com"
                                        className="w-full bg-white/10 border border-white/20 text-white focus:border-white/40 focus:ring-0 rounded-lg h-12 px-4 placeholder:text-muted-foreground outline-none transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="text-zinc-200 dark:text-zinc-300 text-sm font-medium mb-1 block">Password</label>
                                    <div className="relative">
                                        <input
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            defaultValue="Password123!"
                                            className="w-full bg-white/10 border border-white/20 text-white focus:border-white/40 focus:ring-0 rounded-lg h-12 px-4 pr-10 outline-none transition-colors"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-3.5 text-zinc-300 hover:text-white transition-colors"
                                        >
                                            {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                {isRegistering && (
                                    <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
                                        <div className="flex items-start gap-2 text-xs text-green-400">
                                            <div className="mt-0.5">
                                                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="font-medium text-green-200 mb-1">Password requirements met:</p>
                                                <ul className="space-y-1 ml-1">
                                                    <li className="flex items-center gap-2">
                                                        <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        <span>Minimum 8 characters</span>
                                                    </li>
                                                    <li className="flex items-center gap-2">
                                                        <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        <span>At least one uppercase letter</span>
                                                    </li>
                                                    <li className="flex items-center gap-2">
                                                        <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        <span>At least one number</span>
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button type="submit" className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:opacity-90 font-bold text-base shadow-lg shadow-black/10 transition-all">
                                    {isRegistering ? 'Create Account' : 'Login Now'}
                                </button>
                            </form>

                            {!isRegistering && (
                                <div className="text-center">
                                    <button className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">
                                        Forget password <span className="text-white underline decoration-zinc-400 underline-offset-4 pointer-events-auto">Click here</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
