import { AppShell } from "@/components/app-shell";
import { FilterableTable } from "@/components/filterable-table";

export default function StaffPage() {
  return (
    <AppShell title="Staff">
      <FilterableTable
        empty="No staff records yet."
        rows={[]}
        columns={[
          { key: "name", header: "Name", className: "font-medium" },
          { key: "role", header: "Role" },
          { key: "dept", header: "Department" },
          { key: "email", header: "Email" },
        ]}
      />
    </AppShell>
  );
}
