-- Allow authenticated users to read all profile usernames (for community plans)
CREATE POLICY "Authenticated users can view all usernames"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert learning plans
CREATE POLICY "Users can create learning plans"
  ON learning_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to read plan_nodes from their own plans or public plans
CREATE POLICY "Users can view own plan nodes"
  ON plan_nodes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_plans lp
      WHERE lp.id = plan_nodes.plan_id AND (lp.user_id = auth.uid() OR lp.is_public = true)
    )
  );

-- Allow users to insert plan_nodes for their own plans
CREATE POLICY "Users can create plan nodes"
  ON plan_nodes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_plans lp
      WHERE lp.id = plan_nodes.plan_id AND lp.user_id = auth.uid()
    )
  );

-- Allow users to update/delete their own plan nodes
CREATE POLICY "Users can update own plan nodes"
  ON plan_nodes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_plans lp
      WHERE lp.id = plan_nodes.plan_id AND lp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own plan nodes"
  ON plan_nodes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_plans lp
      WHERE lp.id = plan_nodes.plan_id AND lp.user_id = auth.uid()
    )
  );