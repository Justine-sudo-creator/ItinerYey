-- Trip Hosting Messages Policies
-- Allow users to UPDATE their own messages
CREATE POLICY "Allow users to update own messages" ON public.trip_hosting_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Allow users to DELETE their own messages
CREATE POLICY "Allow users to delete own messages" ON public.trip_hosting_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Allow host to DELETE any message
CREATE POLICY "Allow host to delete messages" ON public.trip_hosting_messages FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.trip_hosting WHERE id = hosting_id AND host_user_id = auth.uid())
);

-- Trip Comments (Discussion Board) Policies
DO $$
BEGIN
    -- Allow users to UPDATE their own comments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow users to update own comments' AND tablename = 'trip_comments') THEN
        CREATE POLICY "Allow users to update own comments" ON public.trip_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
    END IF;

    -- Allow users to DELETE their own comments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow users to delete own comments' AND tablename = 'trip_comments') THEN
        CREATE POLICY "Allow users to delete own comments" ON public.trip_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
    END IF;

    -- Allow trip owner to DELETE any comment
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow trip owner to delete comments' AND tablename = 'trip_comments') THEN
        CREATE POLICY "Allow trip owner to delete comments" ON public.trip_comments FOR DELETE TO authenticated USING (
            EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
        );
    END IF;
END $$;
