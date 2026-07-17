/**
 * Set Stripe Bypass (billing_mode = partner) on all pro_teams orgs
 * whose members are not platform admins. Complimentary / unpaid Pro·Teams
 * entitlements should not depend on Stripe subscription status.
 *
 * Usage:
 *   node scripts/migrate-pro-teams-to-partner.mjs --staging
 *   node scripts/migrate-pro-teams-to-partner.mjs --prod
 *   node scripts/migrate-pro-teams-to-partner.mjs --staging --dry-run
 */
import { connectTarget } from "./db-connection.mjs";

const args = process.argv.slice(2);
const target = args.includes("--prod") ? "prod" : args.includes("--staging") ? "staging" : null;
const dryRun = args.includes("--dry-run");

if (!target) {
  console.error("Usage: node scripts/migrate-pro-teams-to-partner.mjs --staging|--prod [--dry-run]");
  process.exit(1);
}

async function main() {
  const { client, via } = await connectTarget(target);
  console.log(`Connected to ${target} via ${via}${dryRun ? " (dry-run)" : ""}`);

  const { rows: candidates } = await client.query(`
    SELECT
      o.id,
      o.name,
      o.slug,
      o.plan,
      o.billing_mode,
      o.subscription_status,
      o.current_period_end,
      o.stripe_customer_id IS NOT NULL AS has_stripe_customer,
      o.stripe_subscription_id IS NOT NULL AS has_stripe_sub,
      (
        SELECT count(*)::int FROM profiles p
        WHERE p.organization_id = o.id AND coalesce(p.is_admin, false) = true
      ) AS admin_member_count,
      (
        SELECT count(*)::int FROM profiles p WHERE p.organization_id = o.id
      ) AS member_count,
      (
        SELECT string_agg(coalesce(p.username, left(p.id::text, 8)), ', ' ORDER BY p.username NULLS LAST)
        FROM profiles p WHERE p.organization_id = o.id
      ) AS members
    FROM organizations o
    WHERE o.plan = 'pro_teams'
      AND coalesce(o.billing_mode, 'subscription') IS DISTINCT FROM 'partner'
      AND NOT EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.organization_id = o.id AND coalesce(p.is_admin, false) = true
      )
    ORDER BY o.name, o.id
  `);

  console.log(`Candidates (pro_teams, not partner, no admin members): ${candidates.length}`);
  for (const row of candidates) {
    console.log(
      JSON.stringify({
        id: row.id,
        name: row.name,
        billing_mode: row.billing_mode,
        subscription_status: row.subscription_status,
        has_stripe_customer: row.has_stripe_customer,
        has_stripe_sub: row.has_stripe_sub,
        members: row.members,
      })
    );
  }

  if (candidates.length === 0) {
    console.log("Nothing to update.");
    await client.end();
    return;
  }

  if (dryRun) {
    console.log("Dry-run complete; no writes.");
    await client.end();
    return;
  }

  const ids = candidates.map((r) => r.id);
  const { rowCount } = await client.query(
    `
    UPDATE organizations
    SET
      billing_mode = 'partner',
      subscription_status = 'active',
      current_period_end = NULL,
      updated_at = now()
    WHERE id = ANY($1::uuid[])
      AND plan = 'pro_teams'
    `,
    [ids]
  );

  console.log(`Updated ${rowCount} organization(s) → billing_mode=partner, status=active`);

  const { rows: after } = await client.query(`
    SELECT plan, billing_mode, subscription_status, count(*)::int AS n
    FROM organizations
    WHERE plan = 'pro_teams'
    GROUP BY 1, 2, 3
    ORDER BY 1, 2, 3
  `);
  console.log("pro_teams distribution after:", after);

  const { rows: leftover } = await client.query(`
    SELECT o.id, o.name, o.billing_mode
    FROM organizations o
    WHERE o.plan = 'pro_teams'
      AND coalesce(o.billing_mode, 'subscription') <> 'partner'
      AND NOT EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.organization_id = o.id AND coalesce(p.is_admin, false) = true
      )
  `);
  if (leftover.length > 0) {
    console.error("FAILED: leftover non-partner pro_teams orgs:", leftover);
    process.exitCode = 1;
  } else {
    console.log("OK: all non-admin pro_teams orgs use partner (Stripe Bypass).");
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
