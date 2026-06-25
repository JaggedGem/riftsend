const requireEnv = (key: string): string => {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing ${key}`);
  }
  return value;
};

const requireBooleanEnv = (key: string): boolean => {
  const value = import.meta.env[key];
  if (value === undefined || value === null) {
    throw new Error(`Missing ${key}`);
  }
  return value === "true";
};

let _config: {
  signalingUrl: string;
  protocolVersion: number;
  clientVersion: string;
  clientName: string;
  clientPlatform: string;
  supportResume: boolean;
  supportChunkAck: boolean;
} | null = null;

export const getConfig = () => {
  if (!_config) {
    _config = {
      signalingUrl: requireEnv("VITE_SIGNALING_SERVER_URL"),
      protocolVersion: parseInt(requireEnv("VITE_SIGNALING_PROTOCOL_VERSION"), 10),
      clientVersion: requireEnv("VITE_SIGNALING_CLIENT_VERSION"),
      clientName: requireEnv("VITE_SIGNALING_CLIENT_NAME"),
      clientPlatform: requireEnv("VITE_SIGNALING_CLIENT_PLATFORM"),
      supportResume: requireBooleanEnv("VITE_SIGNALING_CLIENT_SUPPORT_RESUME"),
      supportChunkAck: requireBooleanEnv("VITE_SIGNALING_CLIENT_SUPPORT_CHUNK_ACK"),
    };
  }
  return _config;
};
