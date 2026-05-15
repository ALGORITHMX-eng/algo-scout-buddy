import { Document, Page, Text, View, StyleSheet, Link, Svg, Path, pdf } from "@react-pdf/renderer";

const c = { black: "#111111", mid: "#444444", light: "#777777", rule: "#cccccc", blue: "#1a56db" };

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9.5, color: c.black, paddingTop: 36, paddingBottom: 36, paddingHorizontal: 48 },
  header: { alignItems: "center", marginBottom: 12 },
  name: { fontSize: 22, fontFamily: "Helvetica-Bold", letterSpacing: 1.5, marginBottom: 3 },
  targetTitle: { fontSize: 8.5, color: c.light, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 },
  contactRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 4 },
  contactItem: { flexDirection: "row", alignItems: "center", gap: 2 },
  contactText: { fontSize: 8.5, color: c.mid },
  contactSep: { fontSize: 8.5, color: c.rule, marginHorizontal: 2 },
  contactLink: { fontSize: 8.5, color: c.blue, textDecoration: "none" },
  section: { marginBottom: 9 },
  sectionHead: { fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 2, borderBottomWidth: 0.3, borderBottomColor: c.rule, paddingBottom: 2, marginBottom: 5 },
  skillRow: { flexDirection: "row", marginBottom: 2 },
  skillLabel: { fontFamily: "Helvetica-Bold", fontSize: 8.5, width: 100, color: c.black },
  skillValue: { fontSize: 8.5, color: c.mid, flex: 1, lineHeight: 1.4 },
  entryBlock: { marginBottom: 6 },
  entryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
  entryTitle: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  entryDate: { fontSize: 8, color: c.light },
  entryCompany: { fontSize: 8.5, fontFamily: "Helvetica-Oblique", color: c.mid, marginBottom: 2 },
  bullet: { flexDirection: "row", marginBottom: 2, paddingLeft: 4 },
  bulletDot: { fontSize: 8.5, marginRight: 4, color: c.mid, marginTop: 1 },
  bulletText: { fontSize: 8.5, flex: 1, color: c.black, lineHeight: 1.4 },
  projectBlock: { marginBottom: 5 },
  projectHeaderRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 1 },
  projectName: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  projectSep: { fontSize: 8.5, color: c.light, marginHorizontal: 3 },
  projectTech: { fontSize: 8, color: c.mid, fontFamily: "Helvetica-Oblique", flex: 1 },
  summary: { fontSize: 9, lineHeight: 1.5, color: c.black },
  eduAchievement: { fontSize: 8.5, color: c.mid, marginTop: 1, fontFamily: "Helvetica-Oblique" },
});

const IconPhone = () => (<Svg width="8" height="8" viewBox="0 0 24 24"><Path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C9.6 21 3 14.4 3 7c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#444444" /></Svg>);
const IconEmail = () => (<Svg width="8" height="8" viewBox="0 0 24 24"><Path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="#444444" /></Svg>);
const IconLocation = () => (<Svg width="8" height="8" viewBox="0 0 24 24"><Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#444444" /></Svg>);
const IconLinkedIn = () => (<Svg width="8" height="8" viewBox="0 0 24 24"><Path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" fill="#1a56db" /></Svg>);
const IconGitHub = () => (<Svg width="8" height="8" viewBox="0 0 24 24"><Path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" fill="#444444" /></Svg>);

function categorizeSkills(skills) {
  const map = [
    ["AI / LLM", ["LangGraph","LangChain","Groq","LLaMA","Agentic","Prompt Engineering","HuggingFace","MiniLM","Sentence Embedding","RAG","Scikit","Hallucination","Prompt Injection"]],
    ["Languages", ["Python","TypeScript","JavaScript","SQL","PostgreSQL","C++","Java","Go","Rust"]],
    ["Backend / Infra", ["Node.js","Supabase","pgvector","REST","FastAPI","Django","Express","MongoDB","Netlify","Vercel"]],
    ["Automation", ["n8n","Make.com","Slack API","Gmail API","Botpress","NDPR"]],
    ["Tools", ["Git","GitHub","Docker","AWS"]],
  ];
  const result = [];
  const used = new Set();
  for (const [label, keywords] of map) {
    const matched = skills.filter(sk => !used.has(sk) && keywords.some(k => sk.toLowerCase().includes(k.toLowerCase())));
    if (matched.length) { matched.forEach(sk => used.add(sk)); result.push({ label, items: matched }); }
  }
  const rest = skills.filter(sk => !used.has(sk));
  if (rest.length) result.push({ label: "Other", items: rest });
  return result;
}

function isValidUrl(val) {
  if (!val) return false;
  if (val.toLowerCase() === "portfolio") return false;
  return val.startsWith("http") || val.includes(".");
}

const ResumePDFDoc = ({ data }) => {
  const skillGroups = categorizeSkills(data.skills || []);
  const country = data.location?.split(",").pop()?.trim() || data.location;
  const hasPortfolio = isValidUrl(data.portfolio);
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.name}>{data.name}</Text>
          {data.targetTitle && <Text style={s.targetTitle}>{data.targetTitle}</Text>}
          <View style={s.contactRow}>
            {data.phone && <View style={s.contactItem}><IconPhone /><Text style={s.contactText}> {data.phone}</Text></View>}
            {data.phone && data.email && <Text style={s.contactSep}>|</Text>}
            {data.email && <View style={s.contactItem}><IconEmail /><Text style={s.contactText}> {data.email}</Text></View>}
            {country && <Text style={s.contactSep}>|</Text>}
            {country && <View style={s.contactItem}><IconLocation /><Text style={s.contactText}> {country}</Text></View>}
            {data.linkedin && <><Text style={s.contactSep}>|</Text><View style={s.contactItem}><IconLinkedIn /><Link src={data.linkedin.startsWith("http") ? data.linkedin : `https://${data.linkedin}`} style={s.contactLink}> LinkedIn</Link></View></>}
            {data.github && <><Text style={s.contactSep}>|</Text><View style={s.contactItem}><IconGitHub /><Link src={data.github.startsWith("http") ? data.github : `https://${data.github}`} style={s.contactLink}> GitHub</Link></View></>}
            {hasPortfolio && <><Text style={s.contactSep}>|</Text><Link src={data.portfolio.startsWith("http") ? data.portfolio : `https://${data.portfolio}`} style={s.contactLink}>Portfolio</Link></>}
          </View>
        </View>
        {data.summary && <View style={s.section}><Text style={s.sectionHead}>Summary</Text><Text style={s.summary}>{data.summary}</Text></View>}
        {skillGroups.length > 0 && <View style={s.section}><Text style={s.sectionHead}>Technical Skills</Text>{skillGroups.map(({ label, items }) => (<View key={label} style={s.skillRow}><Text style={s.skillLabel}>{label}:</Text><Text style={s.skillValue}>{items.join(", ")}</Text></View>))}</View>}
        {data.experience?.length > 0 && <View style={s.section}><Text style={s.sectionHead}>Experience</Text>{data.experience.map((job, i) => (<View key={i} style={s.entryBlock}><View style={s.entryRow}><Text style={s.entryTitle}>{job.title}</Text><Text style={s.entryDate}>{job.duration}</Text></View><Text style={s.entryCompany}>{job.company}</Text>{job.bullets?.map((bullet, j) => (<View key={j} style={s.bullet}><Text style={s.bulletDot}>•</Text><Text style={s.bulletText}>{bullet}</Text></View>))}</View>))}</View>}
        {data.projects?.length > 0 && <View style={s.section}><Text style={s.sectionHead}>Projects</Text>{data.projects.map((project, i) => (<View key={i} style={s.projectBlock}><View style={s.projectHeaderRow}><Text style={s.projectName}>{project.name}</Text>{project.tech?.length > 0 && <><Text style={s.projectSep}>—</Text><Text style={s.projectTech}>{project.tech.join(" · ")}</Text></>}</View>{project.description && <View style={s.bullet}><Text style={s.bulletDot}>•</Text><Text style={s.bulletText}>{project.description}</Text></View>}</View>))}</View>}
        {data.education && <View style={s.section}><Text style={s.sectionHead}>Education</Text><View style={s.entryBlock}><View style={s.entryRow}><Text style={s.entryTitle}>{data.education.school}</Text><Text style={s.entryDate}>{data.education.year}</Text></View><Text style={s.entryCompany}>{data.education.degree}</Text>{data.education.achievements && <Text style={s.eduAchievement}>{data.education.achievements}</Text>}</View></View>}
      </Page>
    </Document>
  );
};

export const downloadResumePDF = async (data, filename) => {
  const blob = await pdf(<ResumePDFDoc data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `${data.name?.replace(/\s+/g, "_")}_Resume.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

export default ResumePDFDoc;