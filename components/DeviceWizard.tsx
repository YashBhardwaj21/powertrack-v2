import React, { useState, useEffect } from 'react';
import {
    Cpu, Globe, Key, Terminal, Wifi, CheckCircle2,
    ArrowRight, ArrowLeft, Copy, Loader2, AlertTriangle, Building2, Zap, X as CloseIcon
} from 'lucide-react';
import { createSchool, subscribeToTelemetry } from '../services/dataService';

interface DeviceWizardProps {
    onClose: () => void;
    onComplete: (schoolId: string, user?: any) => void;
}

export const DeviceWizard: React.FC<DeviceWizardProps> = ({ onClose, onComplete }) => {
    const [step, setStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Organization details
    const [orgData, setOrgData] = useState({
        name: '',
        type: 'Primary School',
        district: '',
        total_capacity_kwp: 5.0,
        total_cost_idr: 0
    });

    // Hardware details
    const [deviceType, setDeviceType] = useState('');
    const [availableProfiles, setAvailableProfiles] = useState<any[]>([]);
    const [loadingProfiles, setLoadingProfiles] = useState(false);
    const [protocol, setProtocol] = useState('http');

    // Created School State (Populated after Step 3)
    const [schoolId, setSchoolId] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [committedUser, setCommittedUser] = useState<any>(null); // Store authoritative user

    // Step 5: Connection State
    const [isConnecting, setIsConnecting] = useState(false);
    const [livePacket, setLivePacket] = useState<any>(null);

    useEffect(() => {
        // Dynamic: Fetch profiles from backend
        const fetchProfiles = async () => {
            try {
                setLoadingProfiles(true);
                const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
                const res = await fetch(`${API_BASE}/device-profiles`);
                if (res.ok) {
                    const profiles = await res.json();
                    setAvailableProfiles(profiles);
                }
            } catch (err) {
                console.error("Failed to fetch profiles", err);
            } finally {
                setLoadingProfiles(false);
            }
        };
        fetchProfiles();
    }, []);

    const steps = [
        { title: "Organization", icon: Building2 },
        { title: "Hardware", icon: Cpu },
        { title: "Network", icon: Globe },
        { title: "Credentials", icon: Key }, // Was "Identify"
        { title: "Format", icon: Terminal },
        { title: "Validate", icon: Wifi }
    ];

    const getProfileIcon = (name: string) => {
        const lower = name.toLowerCase();
        if (lower.includes('monitor') || lower.includes('iot')) return Cpu;
        if (lower.includes('modbus')) return Terminal;
        if (lower.includes('inverter')) return Globe;
        return Wifi;
    };

    const handleNextStep = async () => {
        // Step 2 logic is handled directly by protocol buttons
        setStep(prev => prev + 1);
    };

    const handleCreateSchool = async (selectedProtocol?: string) => {
        // Prevent double submission
        if (isCreating) return;

        setIsCreating(true);
        setError(null);

        // Ensure state protocol is updated if passed directly (for button clicks)
        if (selectedProtocol) {
            setProtocol(selectedProtocol);
        }

        const finalProtocol = selectedProtocol || protocol;

        try {
            // 1. Create School (Backend generates API Key, timezone, coords)
            const result = await createSchool({
                ...orgData,
                device_profile_id: deviceType || undefined, // Send if selected
                connection_protocol: finalProtocol as 'http' | 'mqtt'
            });

            console.log('[Wizard] School Created:', result);

            const { school, user: updatedUser, token } = result;

            // 2. Store Creds
            setSchoolId(school.id);
            setApiKey(school.api_key || 'HIDDEN'); // Backend ensures this is returned on creation

            // 3. Update Session
            if (token) sessionStorage.setItem('auth_token', token);
            if (updatedUser) setCommittedUser(updatedUser);

            // 4. Move to Credentials Step
            setStep(3);
        } catch (err: any) {
            console.error('Failed to create school:', err);
            setError(err.message || 'Failed to create organization. Please try again.');
        } finally {
            setIsCreating(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    // Step 5: Real Connection Test
    const handleTestStart = () => {
        setIsConnecting(true);
        setError(null);

        // Subscribe explicitly to this new school ID
        // Note: Global dashboard subscription might pick it up, but we want a dedicated listener
        // The subscribeToTelemetry function handles single-callback.
        // We can just rely on the global stream if we are school admin, 
        // BUT for the wizard, a dedicated check is safer.
        // Actually, let's use the same service but filter for OUR schoolId.

        const unsubscribe = subscribeToTelemetry(null, (message) => {
            if (message.type === 'telemetry_update' && message.data) {
                if (message.data.school_id === schoolId) {
                    console.log('[Wizard] Packet Received:', message.data);
                    setLivePacket(message.data);
                    setIsConnecting(false);
                    // Unsub happens in useEffect cleanup or manually? 
                    // subscribeToTelemetry returns unsubscribe, we should call it.
                    unsubscribe();
                }
            }
        });

        // Timeout after 60s
        setTimeout(() => {
            if (isConnecting) {
                // If still connecting after timeout (this logic is simplified, React state might be stale)
                // In a real app, use ref or separate timeout logic. 
                // For now, let user cancel manually.
            }
        }, 60000);
    };

    const handleFinalSubmit = () => {
        onComplete(schoolId, committedUser);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Stepper Header */}
                <div className="bg-slate-50 border-b border-slate-100 px-4 py-4 md:px-8 md:py-6">
                    <div className="flex justify-between items-center mb-4 md:mb-6">
                        <h2 className="text-xl font-bold text-slate-800">Registration Wizard</h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex items-center justify-between relative px-2">
                        <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-200 z-0" />
                        {steps.map((s, i) => (
                            <div key={i} className="relative z-10 flex flex-col items-center gap-2">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${step > i ? 'bg-blue-600 border-blue-600 text-white' :
                                    step === i ? 'bg-white border-blue-600 text-blue-600 scale-110 shadow-lg shadow-blue-200' :
                                        'bg-white border-slate-200 text-slate-400'
                                    }`}>
                                    {step > i ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider hidden md:block ${step === i ? 'text-blue-600' : 'text-slate-400'
                                    }`}>{s.title}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-4 md:p-8 min-h-[450px]">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center gap-3 animate-in fade-in">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            <p className="text-sm text-red-700 font-medium">{error}</p>
                        </div>
                    )}

                    {step === 0 && ( /* ORGANIZATION */
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="text-center max-w-sm mx-auto mb-6">
                                <h3 className="text-lg font-bold text-slate-900">Organization Profile</h3>
                                <p className="text-sm text-slate-500">First, let's establish your organization's presence on the platform.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Organization Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. SMAN 1 Jakarta"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                                        value={orgData.name}
                                        onChange={e => setOrgData({ ...orgData, name: e.target.value })}
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">District</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Central Jakarta"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                                        value={orgData.district}
                                        onChange={e => setOrgData({ ...orgData, district: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Solar Capacity (kWp)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all text-sm pr-10"
                                            value={orgData.total_capacity_kwp}
                                            onChange={e => setOrgData({ ...orgData, total_capacity_kwp: parseFloat(e.target.value) })}
                                        />
                                        <Zap className="w-4 h-4 text-blue-400 absolute right-3 top-3" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</label>
                                    <select
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                                        value={orgData.type}
                                        onChange={e => setOrgData({ ...orgData, type: e.target.value })}
                                    >
                                        <option>Primary School</option>
                                        <option>High School</option>
                                        <option>University</option>
                                        <option>Government Hub</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleNextStep}
                                disabled={!orgData.name || !orgData.district}
                                className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                            >
                                Continue <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {step === 1 && ( /* HARDWARE */
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="text-center max-w-sm mx-auto mb-8">
                                <h3 className="text-lg font-bold text-slate-900">Brief Hardware Profile</h3>
                                <p className="text-sm text-slate-500">Choosing the correct type helps with data validation.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {loadingProfiles ? (
                                    <div className="col-span-2 text-center py-8 text-slate-400">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading...
                                    </div>
                                ) : availableProfiles.length === 0 ? (
                                    <div className="col-span-2 text-center p-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                                        No profiles found. You can skip this or use Generic.
                                    </div>
                                ) : (
                                    availableProfiles.map(p => {
                                        const Icon = getProfileIcon(p.name);
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => { setDeviceType(p.id); handleNextStep(); }}
                                                className={`p-4 rounded-xl border-2 text-left transition-all hover:border-blue-400 group ${deviceType === p.id ? 'border-blue-600 bg-blue-50/50' : 'border-slate-100 hover:bg-slate-50'}`}
                                            >
                                                <div className={`p-2 rounded-lg mb-3 inline-block ${deviceType === p.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                    <Icon className="w-6 h-6" />
                                                </div>
                                                <h4 className="font-bold text-slate-800 text-sm truncate">{p.name}</h4>
                                                <p className="text-xs text-slate-500 mt-1">{p.vendor || 'Generic'}</p>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                            <button
                                onClick={handleNextStep}
                                className="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 mt-4 transition-all"
                            >
                                Skip Hardware Selection
                            </button>
                        </div>
                    )}

                    {step === 2 && ( /* NETWORK/PROTOCOL */
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="text-center max-w-sm mx-auto mb-8">
                                <h3 className="text-lg font-bold text-slate-900">Communication Protocol</h3>
                                <p className="text-sm text-slate-500">How should your device send data to our cloud?</p>
                            </div>
                            <div className="space-y-4">
                                <button
                                    onClick={() => { setProtocol('http'); handleCreateSchool('http'); }}
                                    disabled={isCreating}
                                    className="w-full p-5 rounded-xl border-2 border-slate-100 hover:border-blue-400 hover:bg-slate-50 transition-all text-left flex items-start gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="p-3 bg-slate-100 text-slate-400 rounded-xl group-hover:bg-blue-100 group-hover:text-blue-600">
                                        <Globe className="w-8 h-8" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-800">HTTP REST (Simple)</h4>
                                        <p className="text-xs text-slate-500 mt-1">Easiest to implement. Best for standard Wi-Fi.</p>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
                                </button>
                                <button
                                    onClick={() => { setProtocol('mqtt'); handleCreateSchool('mqtt'); }}
                                    disabled={isCreating}
                                    className="w-full p-5 rounded-xl border-2 border-slate-100 hover:border-blue-400 hover:bg-slate-50 transition-all text-left flex items-start gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="p-3 bg-slate-100 text-slate-400 rounded-xl group-hover:bg-blue-100 group-hover:text-blue-600">
                                        <Wifi className="w-8 h-8" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-800">MQTT (Recommended)</h4>
                                        <p className="text-xs text-slate-500 mt-1">Industrial standard. Efficient for low bandwidth.</p>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
                                </button>
                            </div>
                            {isCreating && (
                                <div className="mt-8 text-center animate-pulse">
                                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                                    <p className="text-sm font-bold text-slate-600">Provisioning School & Generating Keys...</p>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && ( /* CREDENTIALS (NOW REAL) */
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="text-center max-w-sm mx-auto mb-8">
                                <h3 className="text-lg font-bold text-slate-900">Security & Credentials</h3>
                                <p className="text-sm text-slate-500">Use these valid credentials to authenticate.</p>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Access Key (X-API-KEY)</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 font-mono text-sm bg-slate-900 text-emerald-400 p-3 rounded-lg border border-slate-800 select-all overflow-hidden text-ellipsis">
                                            {apiKey}
                                        </div>
                                        <button onClick={() => copyToClipboard(apiKey)} className="bg-slate-100 hover:bg-slate-200 p-3 rounded-lg text-slate-600">
                                            <Copy className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        {protocol === 'http' ? 'API Endpoint' : 'MQTT Broker & Topic'}
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 font-mono text-xs bg-slate-100 text-slate-600 p-3 rounded-lg border border-slate-200 select-all">
                                            {protocol === 'http'
                                                ? 'https://api.powertrack.io/v1/telemetry/ingest'
                                                : `powertrack/${schoolId}/telemetry`}
                                        </div>
                                        <button onClick={() => copyToClipboard(protocol === 'http' ? 'https://api.powertrack.io/v1/telemetry/ingest' : `powertrack/${schoolId}/telemetry`)} className="bg-slate-100 hover:bg-slate-200 p-3 rounded-lg">
                                            <Copy className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3 items-start">
                                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-800 leading-relaxed">
                                        <strong>Save this key.</strong> It will not be shown again.
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setStep(4)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 mt-4 flex items-center justify-center gap-2">
                                Key Saved, Continue <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {step === 4 && ( /* FORMAT - SIMPLIFIED */
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="text-center max-w-sm mx-auto mb-8">
                                <h3 className="text-lg font-bold text-slate-900">Payload Mapping</h3>
                                <p className="text-sm text-slate-500">Configure your device to send this structure.</p>
                            </div>
                            <div className="bg-slate-900 rounded-2xl p-6 relative group">
                                <pre className="font-mono text-sm leading-relaxed text-white">
                                    <span className="text-purple-400">{'{'}</span>{'\n'}
                                    <span className="text-blue-400">  "power_w"</span>: <span className="text-amber-400">2450</span>,{'\n'}
                                    <span className="text-blue-400">  "voltage"</span>: <span className="text-amber-400">230.5</span>{'\n'}
                                    <span className="text-purple-400">{'}'}</span>
                                </pre>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600">
                                Required fields: <strong>power_w</strong> (Watts), <strong>voltage</strong> (Volts).
                            </div>
                            <button onClick={() => setStep(5)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2">
                                Start Connection Test <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {step === 5 && ( /* VALIDATE - REAL */
                        <div className="flex flex-col items-center justify-center space-y-8 py-8 animate-in zoom-in-95 duration-500">
                            {!livePacket ? (
                                <>
                                    <div className="relative">
                                        <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all ${isConnecting ? 'bg-blue-50 border-blue-600/20' : 'bg-slate-50 border-slate-100'}`}>
                                            {isConnecting ? (
                                                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                                            ) : (
                                                <Wifi className="w-10 h-10 text-slate-300" />
                                            )}
                                        </div>
                                        {isConnecting && (
                                            <div className="absolute inset-0 rounded-full border-4 border-blue-600 animate-ping opacity-25" />
                                        )}
                                    </div>

                                    <div className="text-center max-w-sm">
                                        <h3 className="text-xl font-bold text-slate-900 mb-2">
                                            {isConnecting ? 'Listening for signal...' : 'Ready to Test'}
                                        </h3>
                                        <p className="text-sm text-slate-500 leading-relaxed">
                                            {isConnecting
                                                ? 'Send data now. We are monitoring your specific secure channel.'
                                                : 'Click below to start listening for the first packet.'}
                                        </p>
                                    </div>

                                    {!isConnecting && (
                                        <button onClick={handleTestStart} className="bg-slate-900 text-white font-bold px-8 py-3 rounded-xl hover:bg-black transition-all">
                                            Begin Live Listener
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center text-center">
                                    <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
                                        <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Data Received!</h3>
                                    <p className="text-sm text-slate-600 mb-8 max-w-xs">
                                        Successfully connected to <strong>{orgData.name}</strong>.
                                    </p>
                                    <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-10">
                                        <div className="bg-slate-50 p-3 rounded-xl">
                                            <span className="text-[10px] font-bold text-slate-400">Power</span>
                                            <div className="font-mono font-bold text-blue-600">{livePacket.ac_power_kw} kW</div>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl">
                                            <span className="text-[10px] font-bold text-slate-400">Voltage</span>
                                            <div className="font-mono font-bold text-emerald-600">{livePacket.ac_voltage} V</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleFinalSubmit}
                                        className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 flex items-center justify-center gap-2"
                                    >
                                        Finish Setup <ArrowRight className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                    {step > 0 && step < 5 && step !== 3 && ( // Disable back during credentials (silly to go back after creation)
                        <button onClick={() => setStep(step - 1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800">
                            <ArrowLeft className="w-4 h-4" /> Back
                        </button>
                    )}
                    <div />
                    <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:text-slate-800">
                        {step === 5 ? 'Close' : 'Cancel'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const X: React.FC<{ className?: string }> = ({ className }) => <span className={className}>×</span>;
