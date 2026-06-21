-- Require authenticated users for route feedback
DROP POLICY IF EXISTS "Anyone can insert verifications" ON public.route_verifications;

CREATE POLICY "Authenticated users can insert verifications"
ON public.route_verifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Notify route owners when someone submits actionable feedback
CREATE OR REPLACE FUNCTION public.notify_route_owner_on_feedback()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_origin TEXT;
  v_destination TEXT;
  v_actor_name TEXT;
  v_feedback_label TEXT;
BEGIN
  -- Skip self-feedback and "still accurate" confirmations
  IF NEW.verification_type = 'accurate' THEN
    RETURN NEW;
  END IF;

  SELECT user_id, origin, destination
  INTO v_owner_id, v_origin, v_destination
  FROM public.routes WHERE id = NEW.route_id;

  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_actor_name
  FROM public.users WHERE id = NEW.user_id;

  v_feedback_label := CASE NEW.verification_type
    WHEN 'fare_changed' THEN 'reported a fare change'
    WHEN 'boarding_point_changed' THEN 'reported a boarding spot change'
    WHEN 'unavailable' THEN 'marked the route as no longer valid'
    ELSE 'left feedback'
  END;

  INSERT INTO public.notifications (user_id, actor_id, type, title, message, link)
  VALUES (
    v_owner_id,
    NEW.user_id,
    'route_feedback',
    'New feedback on your route',
    format('%s %s on your %s → %s route.',
      COALESCE(v_actor_name, 'Someone'), v_feedback_label, v_origin, v_destination),
    format('/route/%s', NEW.route_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_route_feedback ON public.route_verifications;

CREATE TRIGGER trg_notify_route_feedback
AFTER INSERT ON public.route_verifications
FOR EACH ROW
EXECUTE FUNCTION public.notify_route_owner_on_feedback();
