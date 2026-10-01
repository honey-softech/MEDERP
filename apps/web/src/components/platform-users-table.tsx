"use client";

import { FilterableTable } from "@/components/filterable-table";
import { PlatformRemoveUserButton } from "@/components/platform-remove-user-button";

export type PlatformUserRow = {
  id: string;
  username: string;
  mobile: string;
  email: string;
  role: string;
  status?: string;
  access?: string;
  verified?: string;
  joined: string;
  lastLogin: string;
  edit?: string;
  editHref?: string;
};

export function PlatformUsersTable({
  rows,
  empty,
  showEdit = false,
  minWidthClass = "min-w-[900px]",
}: {
  rows: PlatformUserRow[];
  empty: string;
  showEdit?: boolean;
  minWidthClass?: string;
}) {
  const columns = [
    { key: "username", header: "Username", className: "font-medium" },
    { key: "mobile", header: "Mobile" },
    { key: "email", header: "Email" },
    { key: "role", header: "Role" },
    ...(showEdit
      ? [
          { key: "access", header: "Access" },
          { key: "verified", header: "Verified" },
        ]
      : [{ key: "status", header: "Status" }]),
    { key: "joined", header: showEdit ? "Joined" : "Signed up" },
    { key: "lastLogin", header: "Last login" },
    ...(showEdit ? [{ key: "edit", header: "", hrefKey: "editHref" as const }] : []),
    {
      key: "remove",
      header: "",
      filter: false as const,
      render: (row: Record<string, string>) =>
        row.role === "SOFTWARE ADMIN" || row.role === "HELPDESK" ? null : (
          <PlatformRemoveUserButton userId={row.id} label={`${row.username} / ${row.mobile}`} />
        ),
    },
  ];

  return (
    <FilterableTable
      minWidthClass={minWidthClass}
      empty={empty}
      rows={rows.map((row) => ({ ...row, remove: row.username }))}
      columns={columns}
    />
  );
}
