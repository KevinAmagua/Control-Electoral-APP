import { supabase } from './client';

let channelCounter = 0;

export function subscribeToTableChanges(
  table: string,
  listener: () => void,
): () => void {
  channelCounter += 1;
  const channel = supabase
    .channel(`control-electoral-${table}-${channelCounter}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => listener());

  void channel.subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
