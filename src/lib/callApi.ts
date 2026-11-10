export interface CallData {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  receiverId: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'accepted' | 'rejected' | 'ended';
  createdAt: string;
}

export const createCall = async (callData: Partial<CallData>) => {
  const newCall: CallData = {
    id: 'call_' + Date.now(),
    callerId: callData.callerId || '',
    callerName: callData.callerName || '',
    callerAvatar: callData.callerAvatar,
    receiverId: callData.receiverId || '',
    type: callData.type || 'video',
    status: 'ringing',
    createdAt: new Date().toISOString(),
  };
  return newCall;
};

export const getIncomingCalls = (
  _receiverId: string,
  _onCall: (call: CallData | null) => void
) => {
  return () => {};
};

export const updateCall = async (callId: string, updates: Partial<CallData>) => {
  return { id: callId, ...updates };
};

export default {
  createCall,
  getIncomingCalls,
  updateCall,
};
