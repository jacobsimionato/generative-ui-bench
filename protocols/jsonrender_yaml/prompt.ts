import { stringify } from "yaml";
import { CATALOG, REF_PROP_NAMES, catalog, core } from "./catalog.ts";

const { buildUserPrompt } = core;

const REF_PROP_LIST = [...new Set([...REF_PROP_NAMES.values()].flatMap((s) => [...s]))].join(", ");

const EXAMPLE_DASHBOARD = `root: main
elements:
  main:
    type: Card
    children: [header, status, alert, kpis, trend, actions]
  header:
    type: CardHeader
    props:
      title: Revenue Overview
      subtitle: Last 30 days
  status:
    type: Badge
    props:
      text: On track
      variant: secondary
  alert:
    type: Alert
    props:
      title: Refund spike
      description: Refunds rose 14% week over week
      variant: warning
  kpis:
    type: Table
    props:
      columns: [kpiName, kpiValue]
  kpiName:
    type: Col
    props:
      label: Metric
      data: ["Revenue", "Orders", "Refunds"]
  kpiValue:
    type: Col
    props:
      label: Value
      data: ["$128,400", "1,982", "$3,120"]
  trend:
    type: LineChart
    props:
      labels: ["W1", "W2", "W3", "W4"]
      series: [revSeries]
      variant: natural
      xLabel: Week
      yLabel: USD
  revSeries:
    type: Series
    props:
      category: Revenue
      values: [24100, 30800, 34600, 38900]
  actions:
    type: Buttons
    props:
      buttons: [exportBtn, shareBtn]
  exportBtn:
    type: Button
    props:
      label: Export CSV
  shareBtn:
    type: Button
    props:
      label: Share report
      variant: secondary`;

const EXAMPLE_FORM = `root: main
elements:
  main:
    type: Card
    children: [intro, form]
  intro:
    type: CardHeader
    props:
      title: Book a demo
      subtitle: Tell us about your team
  form:
    type: Form
    props:
      name: demo-request
      buttons: formButtons
      fields: [nameField, emailField, sizeField, planField]
  nameField:
    type: FormControl
    props:
      label: Full name
      input: nameInput
  nameInput:
    type: Input
    props:
      name: name
      placeholder: Jane Smith
  emailField:
    type: FormControl
    props:
      label: Work email
      input: emailInput
      hint: We only use this to reply
  emailInput:
    type: Input
    props:
      name: email
      placeholder: jane@company.com
      type: email
  sizeField:
    type: FormControl
    props:
      label: Team size
      input: sizeSelect
  sizeSelect:
    type: Select
    props:
      name: team_size
      items: [sizeS, sizeM, sizeL]
      placeholder: Choose a range
  sizeS:
    type: SelectItem
    props:
      value: "1-10"
      label: "1-10 people"
  sizeM:
    type: SelectItem
    props:
      value: "11-50"
      label: "11-50 people"
  sizeL:
    type: SelectItem
    props:
      value: "51+"
      label: "51+ people"
  planField:
    type: FormControl
    props:
      label: Interested plan
      input: planRadio
  planRadio:
    type: RadioGroup
    props:
      name: plan
      items: [planCloud, planSelf]
  planCloud:
    type: RadioItem
    props:
      label: Cloud
      description: Managed by us
      value: cloud
  planSelf:
    type: RadioItem
    props:
      label: Self-hosted
      description: Runs in your infra
      value: self
  formButtons:
    type: Buttons
    props:
      buttons: [submitBtn, cancelBtn]
  submitBtn:
    type: Button
    props:
      label: Request demo
      variant: primary
  cancelBtn:
    type: Button
    props:
      label: Cancel
      variant: tertiary`;

export function systemPrompt(): string {
  const lines: string[] = [];
  lines.push("You are a UI generator that outputs YAML.");
  lines.push("");
  lines.push("OUTPUT FORMAT (YAML):");
  lines.push("Output a YAML document describing a UI tree wrapped in a ```yaml-spec code fence.");
  lines.push("The YAML document has two required top-level keys: `root` and `elements`.");
  lines.push("");
  lines.push("RULES:");
  lines.push(`1. Component-valued props (children, ${REF_PROP_LIST}) contain element-id strings (or arrays of them) referring to entries in elements. Define each referenced component as its own entry under elements.`);
  lines.push("2. Enum-typed fields accept ONLY the listed values, exactly as written.");
  lines.push("3. Every required field must be present, every referenced id must exist, and every element must be reachable from the root.");
  lines.push("");
  lines.push("AVAILABLE COMPONENTS (70):");
  lines.push("");

  for (const [name, def] of Object.entries(CATALOG)) {
    const props = def.props.map(([pn, pty]) => {
      let tyStr = pty.t;
      if (pty.enum) tyStr = pty.enum.map((e) => `"${e}"`).join(" | ");
      return `${pn}${pty.req ? "" : "?"}: ${tyStr}`;
    });
    lines.push(`- ${name}: { ${props.join(", ")} } — ${def.desc}`);
  }

  lines.push("");
  lines.push("Two complete worked examples of correct output follow.");
  lines.push("");
  lines.push("Example (dashboard):");
  lines.push("```yaml-spec");
  lines.push(EXAMPLE_DASHBOARD);
  lines.push("```");
  lines.push("");
  lines.push("Example (form):");
  lines.push("```yaml-spec");
  lines.push(EXAMPLE_FORM);
  lines.push("```");

  return lines.join("\n");
}

export function userPrompt(brief: string): string {
  return buildUserPrompt({ prompt: brief });
}
