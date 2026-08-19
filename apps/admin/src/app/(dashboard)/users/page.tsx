import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import type { UserRole } from "@rimalis/types";
import {
  Badge,
  Pagination,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableShell,
} from "@/components/primitives";
import { EmptyState, ErrorState } from "@/components/feedback";
import {
  FilterBar,
  StatusTabs,
  accountState,
  userRole,
  verificationState,
} from "@/components/admin";
import { admin, ctxFor, requireAdmin } from "@/lib/auth";
import { absoluteDate, badgeTone } from "@/lib/format";
import { emptyCopy, hrefForPage, oneOf, optional, pageParam } from "@/lib/admin-params";

export const metadata: Metadata = { title: "Users" };

const ROLES = ["ADMIN", "VENDOR", "CUSTOMER"] as const;

/**
 * Every account on the platform.
 *
 * ## Badges are rendered conditionally, not on every row
 *
 * "Active" and "Verified" are true for almost everyone, and a badge on every row
 * makes the one exception harder to find rather than easier — the eye stops seeing
 * a column where every cell is identical. So only the exceptional state gets a
 * pill: suspended, and unverified. An empty cell means the ordinary thing.
 *
 * `isVerified: false` is the filter worth reaching for first on a support ticket:
 * it gates checkout (not sign-in), so it is the usual explanation for "I registered
 * but I can't order".
 *
 * ## The signed-in admin's own row is marked
 *
 * Because the one action they cannot take is on themselves, and finding that out by
 * clicking is worse than seeing it in the list.
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const role = oneOf<UserRole>(params["role"], ROLES);
  const search = optional(params["search"]);
  const isActive = oneOf(params["isActive"], ["true", "false"] as const);
  const isVerified = oneOf(params["isVerified"], ["true", "false"] as const);
  const page = pageParam(params["page"]);

  const { session } = await requireAdmin("/users");
  const result = await admin.listUsers(ctxFor(session), {
    ...(role !== undefined ? { role } : {}),
    ...(search !== undefined ? { search } : {}),
    // The API parses the token, so the string must survive as a string — see the
    // note on booleanQueryParam. `=== "true"` here, not a cast.
    ...(isActive !== undefined ? { isActive: isActive === "true" } : {}),
    ...(isVerified !== undefined ? { isVerified: isVerified === "true" } : {}),
    page,
  });

  const urlParams = { role, search, isActive, isVerified };
  const filtered = Object.values(urlParams).some((v) => v !== undefined);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading font-semibold tracking-tight">Users</h1>
        <p className="text-body text-ink-muted">
          Every account — shoppers, sellers and admins.
        </p>
      </div>

      <StatusTabs
        basePath="/users"
        param="role"
        current={role}
        params={urlParams}
        tabs={[
          { label: "All" },
          { value: "CUSTOMER", label: "Customers" },
          { value: "VENDOR", label: "Vendors" },
          { value: "ADMIN", label: "Admins" },
        ]}
      />

      <FilterBar
        basePath="/users"
        active={filtered}
        fields={[
          {
            name: "search",
            label: "Search",
            value: search,
            grow: true,
            placeholder: "Email, first or last name",
          },
          {
            name: "isActive",
            label: "Account",
            value: isActive,
            options: [
              { value: "true", label: "Active" },
              { value: "false", label: "Suspended" },
            ],
          },
          {
            name: "isVerified",
            label: "Email",
            value: isVerified,
            options: [
              { value: "true", label: "Confirmed" },
              { value: "false", label: "Not confirmed" },
            ],
          },
        ]}
      />

      {!result.ok ? (
        <ErrorState error={result.error} title="Couldn't load users" />
      ) : result.data.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" strokeWidth={1.5} />}
          {...emptyCopy({
            filtered,
            total: result.meta?.total ?? 0,
            page,
            noun: "users",
            genuinelyEmpty: "Accounts appear here as soon as someone registers.",
          })}
        />
      ) : (
        <>
          <TableShell>
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Role</TH>
                  <TH priority="secondary">Flags</TH>
                  <TH align="end" priority="secondary">
                    Joined
                  </TH>
                </TR>
              </THead>
              <TBody>
                {result.data.map((user) => {
                  const roleTone = userRole(user.role);
                  const isSelf = user.id === session.user.id;
                  const account = accountState(user.isActive);
                  const verification = verificationState(user.isVerified);
                  return (
                    <TR key={user.id}>
                      <TD>
                        <Link
                          href={`/users/${user.id}`}
                          prefetch={false}
                          className="flex flex-col rounded-input font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                        >
                          {`${user.firstName} ${user.lastName}`.trim() || "—"}
                          {isSelf && (
                            <span className="text-meta font-normal text-ink-subtle">
                              This is you
                            </span>
                          )}
                        </Link>
                      </TD>
                      <TD>
                        <span className="text-ink-muted">{user.email}</span>
                      </TD>
                      <TD>
                        <Badge tone={badgeTone(roleTone.tone)}>{roleTone.label}</Badge>
                      </TD>
                      <TD priority="secondary">
                        {/*
                          Only the exceptional states — see the header. Two pills at
                          most, and usually none.
                        */}
                        <span className="flex flex-wrap gap-1.5">
                          {!user.isActive && (
                            <Badge tone={badgeTone(account.tone)}>{account.label}</Badge>
                          )}
                          {!user.isVerified && (
                            <Badge tone={badgeTone(verification.tone)}>
                              {verification.label}
                            </Badge>
                          )}
                        </span>
                      </TD>
                      <TD align="end" priority="secondary">
                        <span className="text-ink-muted">
                          {absoluteDate(user.createdAt)}
                        </span>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableShell>

          {result.meta && (
            <Pagination
              page={result.meta.page}
              totalPages={result.meta.totalPages}
              hrefForPage={(target) => hrefForPage("/users", urlParams, target)}
            />
          )}
        </>
      )}
    </div>
  );
}
