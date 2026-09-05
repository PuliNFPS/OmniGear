import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@gearhub/ui/components/alert';
import { Button } from '@gearhub/ui/components/button';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { DeviceGallery } from '../features/devices/DeviceGallery';
import { useMouseStore } from '../store/mouseStore';
import { DeviceWorkspace } from './DeviceWorkspace';

/** Sucesso some sozinho; erro fica até o usuário dispensar — uma falha nunca deve sumir sem ser vista. */
const SUCCESS_AUTO_DISMISS_MS = 4000;

export function AppShell() {
  const session = useMouseStore((state) => state.session);
  const feedback = useMouseStore((state) => state.feedback);
  const dismissFeedback = useMouseStore((state) => state.dismissFeedback);

  useEffect(() => {
    if (feedback?.type !== 'success') return;
    const timer = setTimeout(dismissFeedback, SUCCESS_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [feedback, dismissFeedback]);

  return (
    <>
      {session ? <DeviceWorkspace /> : <DeviceGallery />}
      {feedback && (
        <div
          className="fixed right-6 bottom-6 z-30 w-[min(380px,calc(100vw-2rem))]"
          aria-live="polite"
        >
          <Alert variant={feedback.type === 'error' ? 'destructive' : 'default'}>
            {feedback.type === 'error' ? <CircleAlert /> : <CircleCheck />}
            <AlertTitle>{feedback.title}</AlertTitle>
            <AlertDescription>{feedback.message}</AlertDescription>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="absolute top-2 right-2"
              onClick={dismissFeedback}
              aria-label="Dispensar aviso"
            >
              <X />
            </Button>
          </Alert>
        </div>
      )}
    </>
  );
}
