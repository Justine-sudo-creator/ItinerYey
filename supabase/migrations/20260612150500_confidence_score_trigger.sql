-- Function to dynamically recalculate route confidence score based on recent verifications
CREATE OR REPLACE FUNCTION public.calculate_route_confidence()
RETURNS TRIGGER AS $$
DECLARE
    v_base_score NUMERIC := 50;
    v_total_modifier NUMERIC := 0;
    v_final_score NUMERIC;
    v_row RECORD;
BEGIN
    -- Sum modifiers from the last 10 verifications for the route
    FOR v_row IN (
        SELECT verification_type 
        FROM public.route_verifications 
        WHERE route_id = NEW.route_id 
        ORDER BY created_at DESC 
        LIMIT 10
    ) LOOP
        IF v_row.verification_type = 'accurate' THEN
            v_total_modifier := v_total_modifier + 15;
        ELSIF v_row.verification_type IN ('fare_changed', 'boarding_point_changed') THEN
            v_total_modifier := v_total_modifier - 5;
        ELSIF v_row.verification_type = 'unavailable' THEN
            v_total_modifier := v_total_modifier - 25;
        END IF;
    END LOOP;

    v_final_score := v_base_score + v_total_modifier;
    
    -- Floor at 0, Cap at 100
    IF v_final_score > 100 THEN
        v_final_score := 100;
    ELSIF v_final_score < 0 THEN
        v_final_score := 0;
    END IF;

    -- Update the route
    UPDATE public.routes 
    SET confidence_score = v_final_score,
        last_verified_at = NOW()
    WHERE id = NEW.route_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_route_confidence ON public.route_verifications;

CREATE TRIGGER trg_update_route_confidence
AFTER INSERT ON public.route_verifications
FOR EACH ROW
EXECUTE FUNCTION public.calculate_route_confidence();
