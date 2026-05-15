import {
  Document, Page, Text, View, StyleSheet, Link, pdf,
} from "@react-pdf/renderer";

const colors = {
  primary: "#111111",
  secondary: "#444444",
  accent: "#2563eb",
  light: "#666666",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.primary,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 50,
  },
  header: { alignItems: "center", marginBottom: 14 },
  name: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    marginBottom: 3,
  },
  targetTitle: {
    fontSize: 10,
    color: colors.secondary,
    letterSpacing: 1,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  contact: {
    fontSize: 9,
    color: colors.secondary,
    flexDirection: "row",
    justifyContent: "center",
  },
  contactItem: {
    fontSize: 9,
    color: colors.secondary,
    marginHorizontal: 3,
  },
  contactSep: {
    fontSize: 9,
    color: colors.light,
    marginHorizontal: 1,
  },
  link: {
    fontSize: 9,
    color: colors.accent,
    textDecoration: "none",
    marginHorizontal: 3,
  },
  section: { marginBottom: 11 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primary,
    paddingBottom: 2,
    marginBottom: 7,
  },
  entryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
  entryTitle: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  entryDate: { fontSize: 9, color: colors.light },
  entryCompany: {
    fontSize: 9.5, fontFamily: "Helvetica-Oblique",
    color: colors.secondary, marginBottom: 3,
  },
  bullet: { flexDirection: "row", marginBottom: 2, paddingLeft: 8 },
  bulletDot: { fontSize: 9.5, marginRight: 4, color: colors.secondary },
  bulletText: { fontSize: 9.5, flex: 1, color: colors.primary, lineHeight: 1.4 },
  entryBlock: { marginBottom: 9 },
  projectRow: { flexDirection: "row", marginBottom: 1 },
  projectName: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  projectSep: { fontSize: 9.5, color: colors.secondary, marginHorizontal: 3 },
  projectDesc: { fontSize: 9.5, color: colors.secondary, flex: 1 },
  projectTech: {
    fontSize: 9, color: colors.light,
    fontFamily: "Helvetica-Oblique", marginTop: 1, marginBottom: 5,
  },
  summary: { fontSize: 9.5, lineHeight: 1.6, color: colors.primary },
  skills: { fontSize: 9.5, lineHeight: 1.8, color: colors.primary },
  eduRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
  eduAchievement: { fontSize: 9, color: colors.light, fontFamily: "Helvetica-Oblique" },
});

export type ResumeData = {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  targetTitle?: string;
  summary: string;
  experience: { title: string; company: string; duration: string; bullets: string[] }[];
  projects?: { name: string; description: string; tech: string[] | string }[];
  skills: string[];
  education: { degree: string; school: string; year: string; achievements?: string };
};

const safeTech = (tech: string[] | string | undefined): string => {
  if (!tech) return "";
  return Array.isArray(tech) ? tech.join(" · ") : tech;
};

const Sep = () => <Text style={styles.contactSep}> | </Text>;

const ResumePDFDoc = ({ data }: { data: ResumeData }) => (
  <Document>
    <Page size="A4" style={styles.page}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.name}>{data.name}</Text>
        {data.targetTitle && (
          <Text style={styles.targetTitle}>{data.targetTitle}</Text>
        )}
        <View style={styles.contact}>
          {data.phone && <Text style={styles.contactItem}>{data.phone}</Text>}
          {data.email && <><Sep /><Text style={styles.contactItem}>{data.email}</Text></>}
          {data.location && <><Sep /><Text style={styles.contactItem}>{data.location}</Text></>}
          {data.linkedin && <><Sep /><Link src={data.linkedin} style={styles.link}>LinkedIn</Link></>}
          {data.github && <><Sep /><Link src={data.github} style={styles.link}>GitHub</Link></>}
          {data.portfolio && <><Sep /><Link src={data.portfolio} style={styles.link}>Portfolio</Link></>}
        </View>
      </View>

      {/* SUMMARY */}
      {data.summary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Professional Summary</Text>
          <Text style={styles.summary}>{data.summary}</Text>
        </View>
      )}

      {/* SKILLS */}
      {data.skills?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Technical Skills</Text>
          <Text style={styles.skills}>{data.skills.join(" · ")}</Text>
        </View>
      )}

      {/* EXPERIENCE */}
      {data.experience?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experience</Text>
          {data.experience.map((job, i) => (
            <View key={i} style={styles.entryBlock}>
              <View style={styles.entryRow}>
                <Text style={styles.entryTitle}>{job.title}</Text>
                <Text style={styles.entryDate}>{job.duration}</Text>
              </View>
              <Text style={styles.entryCompany}>{job.company}</Text>
              {job.bullets?.map((bullet, j) => (
                <View key={j} style={styles.bullet}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* PROJECTS */}
      {data.projects && data.projects.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Projects</Text>
          {data.projects.map((project, i) => (
            <View key={i} style={styles.entryBlock}>
              <View style={styles.projectRow}>
                <Text style={styles.projectName}>{project.name}</Text>
                <Text style={styles.projectSep}> — </Text>
                <Text style={styles.projectDesc}>{project.description}</Text>
              </View>
              <Text style={styles.projectTech}>{safeTech(project.tech)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* EDUCATION */}
      {data.education && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Education</Text>
          <View style={styles.entryBlock}>
            <View style={styles.entryRow}>
              <Text style={styles.entryTitle}>{data.education.degree}</Text>
              <Text style={styles.entryDate}>{data.education.year}</Text>
            </View>
            <View style={styles.eduRow}>
              <Text style={styles.entryCompany}>{data.education.school}</Text>
              {data.education.achievements && (
                <Text style={styles.eduAchievement}>{data.education.achievements}</Text>
              )}
            </View>
          </View>
        </View>
      )}

    </Page>
  </Document>
);

export const downloadResumePDF = async (data: ResumeData, filename?: string) => {
  const blob = await pdf(<ResumePDFDoc data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `${data.name?.replace(/\s+/g, "_")}_Resume.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

export default ResumePDFDoc;