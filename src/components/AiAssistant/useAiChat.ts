import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Message } from './ChatMessages';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://atqjaiebixuzomrfwilu.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cWphaWViaXh1em9tcmZ3aWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTkxOTcsImV4cCI6MjA3Mjc3NTE5N30.OGAQFsAl1Eo1tmPZ93VZoSL5tO2FYZa_szeRvUmoj-4';

export function useAiChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [provider, setProvider] = useState<string | null>(null);

  const loadConversation = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
    }
    setConversationId(convId);
  }, []);

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setProvider(null);
  }, []);

  const saveMessage = useCallback(async (convId: string, role: string, content: string) => {
    await supabase.from('ai_messages').insert({ conversation_id: convId, role, content });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setIsLoading(true);
    setProvider(null);

    // Create or use existing conversation
    let convId = conversationId;
    if (!convId) {
      const title = text.trim().slice(0, 60);
      const { data: newConv } = await supabase
        .from('ai_conversations')
        .insert({ title })
        .select('id')
        .single();

      if (newConv) {
        convId = newConv.id;
        setConversationId(convId);
        setRefreshKey(k => k + 1);
      }
    } else {
      await supabase.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId);
    }

    if (convId) {
      await saveMessage(convId, 'user', text.trim());
    }

    let assistantSoFar = '';

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages, conversationId: convId }),
      });

      if (resp.status === 429) { toast.error('تم تجاوز الحد المسموح، حاول لاحقاً'); setIsLoading(false); return; }
      if (resp.status === 402) { toast.error('رصيد غير كافٍ، يرجى إضافة رصيد'); setIsLoading(false); return; }
      if (!resp.ok || !resp.body) {
        const errText = await resp.text();
        console.error('AI error:', errText);
        toast.error('حدث خطأ في الاتصال بالمساعد');
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        const content = assistantSoFar;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content } : m);
          }
          return [...prev, { role: 'assistant', content }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            // Detect provider from first chunk
            if (parsed.provider && !provider) {
              setProvider(parsed.provider);
            }
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Save assistant message
      if (convId && assistantSoFar) {
        await saveMessage(convId, 'assistant', assistantSoFar);
      }
    } catch (err) {
      console.error('Stream error:', err);
      toast.error('فشل الاتصال بالمساعد الذكي');
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, conversationId, saveMessage, provider]);

  const refreshMemory = useCallback(async () => {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/update-ai-memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({}),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        console.error('Memory update failed:', errData);
        toast.error('فشل تحديث الذاكرة: ' + (errData.error || 'خطأ غير معروف'));
        return;
      }
      const data = await resp.json();
      toast.success(`تم تحديث الذاكرة الذكية (${data.entries || 0} سجل)`);
    } catch (err) {
      console.error('Memory update error:', err);
      toast.error('فشل الاتصال بخدمة تحديث الذاكرة');
    }
  }, []);

  return {
    messages,
    isLoading,
    conversationId,
    refreshKey,
    provider,
    sendMessage,
    loadConversation,
    startNewConversation,
    refreshMemory,
  };
}
