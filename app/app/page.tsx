import PatientGrid, { GroupTabs, PatientStats } from "../patient-grid";
import AgencyBanner from "../agency-banner";
import { Brand } from "../ui";
import { RememberHome } from "../home-link";
import DirectionHeader from "../direction-header";

// Workspace: nav, headline and the patients' grid; the page scrolls when there are more patients than fit the screen.
// The page grid is the patients' 5 columns, with the same gap, so edges line up: the agency banner spans the headline row
// over the last 2 columns; the headline keeps to the first 3.
export default function Workspace() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] min-[1800px]:max-w-[1680px] flex-1 flex-col gap-5 px-4 pt-4 pb-3 lg:gap-4 low:gap-3 lg:px-6">
      <RememberHome home="/app" />
      <nav className="rise flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Brand />
        <PatientStats />
      </nav>

      <div className="grid gap-x-3 gap-y-4 low:gap-y-3 lg:grid-cols-[repeat(5,minmax(0,1fr))] lg:grid-rows-[auto_auto]">
        <section aria-labelledby="trainer" className="flex flex-col gap-4 lg:col-span-5 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:grid lg:grid-rows-subgrid">
          <header className="rise flex flex-wrap items-end justify-between gap-x-6 gap-y-2" style={{ animationDelay: "60ms" }}>
            <div className="max-w-[60ch] lg:max-w-[calc(60%-15px)]">
              <DirectionHeader />
              <div className="mt-2.5 low:mt-2">
                <GroupTabs />
              </div>
            </div>
          </header>
          <PatientGrid />
        </section>

        <AgencyBanner className="z-10 lg:col-start-4 lg:col-end-6 lg:row-start-1 lg:self-stretch" />
      </div>
    </main>
  );
}
