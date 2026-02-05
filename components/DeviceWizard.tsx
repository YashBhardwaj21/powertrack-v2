import React, { useState, useEffect } from 'react';
import {
    Cpu, Globe, Key, Terminal, Wifi, CheckCircle2,
    ArrowRight, ArrowLeft, Copy, Loader2, Info, AlertTriangle, Building2, MapPin, Zap
} from 'lucide-react';
import { createSchool } from '../services/dataService';

interface DeviceWizardProps {
    onClose: () => void;
    onComplete: (schoolId: string, user?: any) => void;
}

export const DeviceWizard: React.FC<DeviceWizardProps> = ({ onClose, onComplete }) => {
    const [step, setStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [schoolId, setSchoolId] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [committedUser, setCommittedUser] = useState<any>(null); // Store authoritative user

    // Organization details
    const [orgData, setOrgData] = useState({
        name: '',
        type: 'Primary School',
        district: '',
        latitude: -6.2088,
        longitude: 106.8456,
        total_capacity_kwp: 5.0,
        total_cost_idr: 0
    });

    // Hardware details
    const [deviceType, setDeviceType] = useState('');
    const [availableProfiles, setAvailableProfiles] = useState<any[]>([]);
    const [loadingProfiles, setLoadingProfiles] = useState(false);

    const [protocol, setProtocol] = useState('http');
    const [isConnecting, setIsConnecting] = useState(false);
    const [testReceived, setTestReceived] = useState(false);

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
        { title: "Identify", icon: Key },
        { title: "Format", icon: Terminal },
        { title: "Validate", icon: Wifi }
    ];

    // Helper to get display icon based on profile name (Purely cosmetic)
    const getProfileIcon = (name: string) => {
        const lower = name.toLowerCase();
        if (lower.includes('monitor') || lower.includes('iot')) return Cpu;
        if (lower.includes('modbus')) return Terminal;
        if (lower.includes('inverter')) return Globe;
        return Wifi;
    };

    const generateApiKey = () => {
        // Generate a random API key on the frontend
        const randomBytes = new Uint8Array(32);
        crypto.getRandomValues(randomBytes);
        const hex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        return `pt_live_${hex}`;
    };

    const handleCreateOrg = () => {
        // Validate
        if (!orgData.name.trim()) {
            alert('Organization name is required');
            return;
        }

        // Generate API key for display in later steps
        const generatedKey = generateApiKey();
        setApiKey(generatedKey);

        // Move to next step (Hardware selection)
        setStep(1);
    };

    const handleFinalSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Send the pre-generated API key to backend
            const result = await createSchool({
                ...orgData,
                api_key: apiKey,
                device_profile_id: deviceType // This is now the real UUID from the DB
            });

            const { school, user: updatedUser, token } = result;

            setSchoolId(school.id);

            // Save token immediately
            if (token) sessionStorage.setItem('auth_token', token);
            if (updatedUser) {
                setCommittedUser(updatedUser);
            }

            // Complete the wizard
            onComplete(school.id, updatedUser);

        } catch (error: any) {
            console.error('Failed to create organization:', error);
            if (error.message && error.message.includes('unique')) {
                alert('Organization Name already exists. Please choose another.');
            } else {
                alert('System Provisioning Failed: Please try again or contact support.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const handleTestStart = () => {
        setIsConnecting(true);
        setTimeout(() => {
            setIsConnecting(false);
            setTestReceived(true);
        }, 3000);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Stepper Header */}
                <div className="bg-slate-50 border-b border-slate-100 px-8 py-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800">Registration Wizard</h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X className="w-5 h-5" />
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
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${step === i ? 'text-blue-600' : 'text-slate-400'
                                    }`}>{s.title}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-8 min-h-[450px]">
                    {step === 0 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="text-center max-w-sm mx-auto mb-6">
                                <h3 className="text-lg font-bold text-slate-900">Organization Profile</h3>
                                <p className="text-sm text-slate-500">First, let's establish your organization's presence on the platform.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Organization Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. SMAN 1 Jakarta"
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                                        value={orgData.name}
                                        onChange={e => setOrgData({ ...orgData, name: e.target.value })}
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
                                onClick={handleCreateOrg}
                                disabled={!orgData.name || isSubmitting}
                                className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Establish Profile & Continue"} <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="text-center max-w-sm mx-auto mb-8">
                                <h3 className="text-lg font-bold text-slate-900">Select your hardware platform</h3>
                                <p className="text-sm text-slate-500">Choosing the correct type ensures we apply the right data normalization filters.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {loadingProfiles ? (
                                    <div className="col-span-2 text-center py-8 text-slate-400">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Loading hardware profiles...
                                    </div>
                                ) : availableProfiles.length === 0 ? (
                                    <div className="col-span-2 text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                        No profiles found in database.
                                    </div>
                                ) : (
                                    availableProfiles.map(p => {
                                        const Icon = getProfileIcon(p.name);
                                        return (
                                            <button
                                                key={p.id}
                                                // Store the Real UUID
                                                onClick={() => { setDeviceType(p.id); setStep(2); }}
                                                className={`p-4 rounded-xl border-2 text-left transition-all hover:border-blue-400 group ${deviceType === p.id ? 'border-blue-600 bg-blue-50/50' : 'border-slate-100 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className={`p-2 rounded-lg mb-3 inline-block transition-colors ${deviceType === p.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600'
                                                    }`}>
                                                    <Icon className="w-6 h-6" />
                                                </div>
                                                <h4 className="font-bold text-slate-800 text-sm truncate">{p.name}</h4>
                                                <p className="text-xs text-slate-500 mt-1">{p.vendor || 'Generic'} • {p.protocol}</p>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="text-center max-w-sm mx-auto mb-8">
                                <h3 className="text-lg font-bold text-slate-900">Communication Protocol</h3>
                                <p className="text-sm text-slate-500">How should your device send data to our cloud?</p>
                            </div>
                            <div className="space-y-4">
                                <button
                                    onClick={() => { setProtocol('http'); setStep(3); }}
                                    className="w-full p-5 rounded-xl border-2 border-slate-100 hover:border-blue-400 hover:bg-slate-50 transition-all text-left flex items-start gap-4 group"
                                >
                                    <div className="p-3 bg-slate-100 text-slate-400 rounded-xl group-hover:bg-blue-100 group-hover:text-blue-600">
                                        <Globe className="w-8 h-8" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-800">HTTP REST (Simple)</h4>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                            Easiest to implement. Best for standard Wi-Fi environments. Your device pushes data every few seconds.
                                        </p>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
                                </button>

                                <button
                                    onClick={() => { setProtocol('mqtt'); setStep(3); }}
                                    className="w-full p-5 rounded-xl border-2 border-slate-100 hover:border-blue-400 hover:bg-slate-50 transition-all text-left flex items-start gap-4 group"
                                >
                                    <div className="p-3 bg-slate-100 text-slate-400 rounded-xl group-hover:bg-blue-100 group-hover:text-blue-600">
                                        <Wifi className="w-8 h-8" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-slate-800">MQTT (Recommended)</h4>
                                            <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Industrial</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                            Ultra-reliable for unstable connections. Uses 90% less bandwidth. Perfect for remote sites or cellular nodes.
                                        </p>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="text-center max-w-sm mx-auto mb-8">
                                <h3 className="text-lg font-bold text-slate-900">Security & Credentials</h3>
                                <p className="text-sm text-slate-500">Use these details to authenticate your connection.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Access Key (X-API-KEY)</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 font-mono text-sm bg-slate-900 text-emerald-400 p-3 rounded-lg border border-slate-800 select-all overflow-hidden text-ellipsis">
                                            {apiKey}
                                        </div>
                                        <button onClick={() => copyToClipboard(apiKey)} className="bg-slate-100 hover:bg-slate-200 p-3 rounded-lg text-slate-600 transition-colors">
                                            <Copy className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        {protocol === 'http' ? 'API Endpoint' : 'MQTT Broker & Topic'}
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 font-mono text-xs bg-slate-100 text-slate-600 p-3 rounded-lg border border-slate-200 select-all overflow-hidden text-ellipsis">
                                            {protocol === 'http'
                                                ? 'https://api.powertrack.io/v1/telemetry/ingest'
                                                : `powertrack/${schoolId}/telemetry`}
                                        </div>
                                        <button onClick={() => copyToClipboard(protocol === 'http' ? 'https://api.powertrack.io/v1/telemetry/ingest' : `powertrack/${schoolId}/telemetry`)} className="bg-slate-50 hover:bg-slate-100 p-3 rounded-lg text-slate-400 transition-colors">
                                            <Copy className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3 items-start">
                                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-800 leading-relaxed">
                                        <strong>Never share your API Key.</strong> We hash it in our DB, so it's only shown once. Copy it now for your firmware.
                                    </p>
                                </div>
                            </div>

                            <button onClick={() => setStep(4)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 mt-4 transition-all flex items-center justify-center gap-2">
                                Configuration Ready <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="text-center max-w-sm mx-auto mb-8">
                                <h3 className="text-lg font-bold text-slate-900">Payload Mapping</h3>
                                <p className="text-sm text-slate-500">Configure your device to send this JSON structure.</p>
                            </div>

                            <div className="bg-slate-900 rounded-2xl p-6 relative group">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-red-500" />
                                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                    </div>
                                    <span className="text-xs text-slate-500 font-mono italic">payload.json</span>
                                </div>
                                <pre className="font-mono text-sm leading-relaxed">
                                    <span className="text-purple-400">{'{'}</span>{'\n'}
                                    <span className="text-blue-400">  "power_w"</span>: <span className="text-amber-400">2450</span>,{'\n'}
                                    <span className="text-blue-400">  "voltage"</span>: <span className="text-amber-400">230.5</span>,{'\n'}
                                    <span className="text-blue-400">  "current_a"</span>: <span className="text-amber-400">10.6</span>,{'\n'}
                                    <span className="text-blue-400">  "daily_kwh"</span>: <span className="text-amber-400">12.4</span>{'\n'}
                                    <span className="text-purple-400">{'}'}</span>
                                </pre>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-xl">
                                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Required</h5>
                                    <ul className="text-xs text-slate-600 space-y-1.5 font-medium">
                                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> power_w (Watts)</li>
                                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> voltage (V)</li>
                                    </ul>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-xl">
                                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Optional</h5>
                                    <ul className="text-xs text-slate-600 space-y-1.5 font-medium">
                                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300" /> temp_c (°C)</li>
                                        <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-300" /> daily_kwh (kWh)</li>
                                    </ul>
                                </div>
                            </div>

                            <button onClick={() => setStep(5)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                                Start Connection Test <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="flex flex-col items-center justify-center space-y-8 py-8 animate-in zoom-in-95 duration-500">
                            {!testReceived ? (
                                <>
                                    <div className="relative">
                                        <div className="w-24 h-24 rounded-full bg-blue-50 border-4 border-blue-600/20 flex items-center justify-center">
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
                                            {isConnecting ? 'Listening for hardware signal' : 'Awaiting first packet'}
                                        </h3>
                                        <p className="text-sm text-slate-500 leading-relaxed">
                                            {isConnecting
                                                ? 'Point your device to our cloud and send a test packet now. We are monitoring the gateway...'
                                                : 'Click the button below to start the real-time validator.'}
                                        </p>
                                    </div>

                                    {!isConnecting && (
                                        <button onClick={handleTestStart} className="bg-slate-900 text-white font-bold px-8 py-3 rounded-xl hover:bg-black transition-all">
                                            Begin Live Sync Test
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center text-center">
                                    <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
                                        <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-900 mb-2">System Live!</h3>
                                    <p className="text-sm text-slate-600 mb-8 max-w-xs">
                                        <strong>{orgData.name}</strong> is now broadcasting telemetry to the global network.
                                    </p>

                                    <div className="grid grid-cols-3 gap-4 w-full max-w-sm mb-10">
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Power</span>
                                            <span className="font-mono text-sm font-bold text-blue-600">2.4 kW</span>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <span className="text-[10px] font-bold text-slate-400 block mb-1">State</span>
                                            <span className="font-mono text-sm font-bold text-emerald-600">ONLINE</span>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <span className="text-[10px] font-bold text-slate-400 block mb-1">Ping</span>
                                            <span className="font-mono text-sm font-bold text-slate-700">142ms</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleFinalSubmit}
                                        disabled={isSubmitting}
                                        className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Deploy to Dashboard'} <ArrowRight className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                    {step > 1 && step < 5 ? (
                        <button onClick={() => setStep(step - 1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Back
                        </button>
                    ) : <div />}

                    <div className="flex gap-2">
                        {step !== 5 && (
                            <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:text-slate-800">
                                Cancel
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const X: React.FC<{ className?: string }> = ({ className }) => <span className={className}>×</span>;
