import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamPage } from "@/pages/content/TeamPage";
import { DepartmentsPage } from "@/pages/content/DepartmentsPage";

/** Team members and their departments, on one page. */
export function TeamHubPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "departments" ? "departments" : "members";
  const tabs = (
    <Tabs value={tab} onValueChange={(v) => setParams(v === "members" ? {} : { tab: v }, { replace: true })} className="mb-4">
      <TabsList>
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="departments">Departments</TabsTrigger>
      </TabsList>
    </Tabs>
  );
  return tab === "members" ? <TeamPage tabs={tabs} /> : <DepartmentsPage tabs={tabs} />;
}
