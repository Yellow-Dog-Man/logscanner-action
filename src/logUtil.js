function extractPCSpecs(logContent) {
    const lines = logContent.split('\n');
    const specs = {};

    for (const line of lines) {
        if (line.includes('CPU: ')) {
            const cpuMatch = line.match(/CPU: (.+?)$/);
            if (cpuMatch) {
                specs.cpu = cpuMatch[1].trim();
            }
        }

        if (line.includes('GPU: ')) {
            const gpuMatch = line.match(/GPU: (.+?)$/);
            if (gpuMatch) {
                specs.gpu = gpuMatch[1].trim();
            }
        }

        if (line.includes('MemoryBytes: ')) {
            const memoryMatch = line.match(/MemoryBytes: (.+?)$/);
            if (memoryMatch) {
                specs.memory = memoryMatch[1].trim();
            }
        }

        if (line.includes('VRAMBytes: ')) {
            const vramMatch = line.match(/VRAMBytes: (.+?)$/);
            if (vramMatch) {
                specs.vram = vramMatch[1].trim();
            }
        }

        if (line.includes('PhysicalCores: ')) {
            const coresMatch = line.match(/PhysicalCores: (.+?)$/);
            if (coresMatch && coresMatch[1].trim()) {
                specs.physicalCores = coresMatch[1].trim();
            }
        }
    }

    return specs;
}

function extractCommandLineFlags(logContent) {
    const lines = logContent.split('\n');
    const flags = [];

    for (const line of lines) {
        if (line.includes('[4] Processing startup commands...')) {
            flags.push('No specific command line flags detected');
        }
    }

    return flags.length > 0 ? flags : [];
}

function extractHeadset(logContent) {
    const lines = logContent.split('\n');
    let headset = '';

    for (const line of lines) {
        if (line.includes('HeadDevice: ')) {
            const headDeviceMatch = line.match(/HeadDevice: (.+?)$/);
            if (headDeviceMatch) {
                headset = headDeviceMatch[1].trim();
            }
        }

        if (line.includes('XR Device Name: ')) {
            const xrNameMatch = line.match(/XR Device Name: (.+?)$/);
            if (xrNameMatch && xrNameMatch[1].trim()) {
                headset += ` (XR: ${xrNameMatch[1].trim()})`;
            }
        }

        if (line.includes('XR Device Model: ')) {
            const xrModelMatch = line.match(/XR Device Model: (.+?)$/);
            if (xrModelMatch && xrModelMatch[1].trim()) {
                headset += ` - ${xrModelMatch[1].trim()}`;
            }
        }
    }

    return headset;
}

function extractOperatingSystem(logContent) {
    const lines = logContent.split('\n');
    let os = '';

    for (const line of lines) {
        if (line.includes('OS: ')) {
            const osMatch = line.match(/OS: (.+?)$/);
            if (osMatch) {
                os = osMatch[1].trim();
            }
        }

        if (line.includes('Detected Wine version: ')) {
            const wineMatch = line.match(/Detected Wine version: (.+?)$/);
            if (wineMatch) {
                os += ` (via Wine ${wineMatch[1].trim()})`;
            }
        }
    }

    return os;
}

function extractResoniteVersion(logContent) {
    const lines = logContent.split('\n');

    for (const line of lines) {
        if (line.includes('Initializing App: ')) {
            const versionMatch = line.match(/Initializing App: (.+?)$/);
            if (versionMatch) {
                return versionMatch[1].trim();
            }
        }
    }

    return '';
}

function checkModLoader(logContent) {
    const lines = logContent.split('\n');
    let isLoaded = false;
    let version = '';

    for (const line of lines) {
        if (line.includes('Loaded Extra Assembly') && line.includes('ResoniteModLoader.dll')) {
            isLoaded = true;
        }

        if (line.includes('[INFO] [ResoniteModLoader] ResoniteModLoader v')) {
            const versionMatch = line.match(/ResoniteModLoader v([0-9.]+)/);
            if (versionMatch) {
                version = versionMatch[1];
            }
        }
    }

    return { isLoaded, version };
}


export function parseResoniteLogContent(logContent) {
    if (typeof logContent !== 'string') {
        throw new Error('Log content must be a string');
    }

    if (!logContent.trim()) {
        throw new Error('Log content cannot be empty');
    }

    const modLoader = checkModLoader(logContent);

    return {
        pcSpecs: extractPCSpecs(logContent),
        commandLineFlags: extractCommandLineFlags(logContent),
        headset: extractHeadset(logContent),
        operatingSystem: extractOperatingSystem(logContent),
        resoniteVersion: extractResoniteVersion(logContent),
        modLoader: {
            isLoaded: modLoader.isLoaded,
            version: modLoader.version
        }
    };
}


function isVRMode(headset) {
    return headset && !headset.includes('Screen');
}


export function getSystemSummary(parsedData) {
    return {
        cpu: parsedData.pcSpecs.cpu || 'Unknown',
        gpu: parsedData.pcSpecs.gpu || 'Unknown',
        os: parsedData.operatingSystem || 'Unknown',
        version: parsedData.resoniteVersion || 'Unknown',
        vrMode: isVRMode(parsedData.headset),
        modded: parsedData.modLoader.isLoaded
    };
}

export function isValidResoniteLog(logContent) {
    if (typeof logContent !== 'string' || !logContent.trim()) {
        return false;
    }
    
    const indicators = [
        'FrooxEngine',
        'Resonite',
        'Initializing App:',
        'Engine Runner'
    ];
    
    return indicators.some(indicator => logContent.includes(indicator));
}
