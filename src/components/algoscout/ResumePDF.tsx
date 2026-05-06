import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
  pdf,
} from "@react-pdf/renderer";

const colors = {
  primary: "#111111",
  secondary: "#444444",
  accent: "#2563eb",
  border: "#cccccc",
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
  // Header
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  name: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    marginBottom: 4,
  },
  contact: {
    fontSize: 9,
    color: colors.secondary,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  contactItem: {
    fontSize: 9,
    color: colors.secondary,
  },
  link: {
    fontSize: 9,
    color: colors.accent,
    textDecoration: "none",
  },
  // Section
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primary,
    paddingBottom: 2,
    marginBottom: 8,
  },
  // Experience
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  entryTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  entryDate: {
    fontSize: 9,
    color: colors.light,
  },
  entryCompany: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Oblique",
    color: colors.secondary,
    marginBottom: 3,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 8,
  },
  bulletDot: {
    fontSize: 9.5,
    marginRight: 4,
    color: colors.secondary,
  },
  bulletText: {
    fontSize: 9.5,
    flex: 1,
    color: colors.primary,
    lineHeight: 1.4,
  },
  entryBlock: {
    marginBottom: 10,
  },
  // Projects
  projectName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  projectDesc: {
    fontSize: 9.5,
    color: colors.secondary,
  },
  projectTech: {
    fontSize: 9,
    color: colors.light,
    fontFamily: "Helvetica-Oblique",
    marginTop: 1,
  },
  // Summary
  summary: {
    fontSize: 9.5,
    lineHeight: 1.6,
    color: colors.primary,
  },
  // Skills
  skills: {
    fontSize: 9.5,
    lineHeight: 1.8,
    color: colors.primary,
  },
});

type ResumeData = {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  summary: string;
  experience: {
    title: string;
    company: string;
    duration: string;
    bullets: string[];
  }[];
  projects?: {
    name: string;
    description: string;
    tech: string[];
  }[];
  skills: string[];
  education: {
    degree: string;
    school: string;
    year: string;
  };
};

const ResumePDFDoc = ({ data }: { data: ResumeData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.name}>{data.name}</Text>
        <View style={styles.contact}>
          <Text style={styles.contactItem}>{data.email}</Text>
          <Text style={styles.contactItem}>|</Text>
          <Text style={styles.contactItem}>{data.phone}</Text>
          <Text style={styles.contactItem}>|</Text>
          <Text style={styles.contactItem}>{data.location}</Text>
          {data.linkedin && (
            <>
              <Text style={styles.contactItem}>|</Text>
              <Link src={data.linkedin} style={styles.link}>LinkedIn</Link>
            </>
          )}
          {data.github && (
            <>
              <Text style={styles.contactItem}>|</Text>
              <Link src={data.github} style={styles.link}>GitHub</Link>
            </>
          )}
          {data.portfolio && (
            <>
              <Text style={styles.contactItem}>|</Text>
              <Link src={data.portfolio} style={styles.link}>Portfolio</Link>
            </>
          )}
        </View>
      </View>

      {/* SUMMARY */}
      {data.summary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Professional Summary</Text>
          <Text style={styles.summary}>{data.summary}</Text>
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
              <Text style={styles.projectName}>{project.name}</Text>
              <Text style={styles.projectDesc}>{project.description}</Text>
              <Text style={styles.projectTech}>
                Tech: {project.tech?.join(", ")}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* SKILLS */}
      {data.skills?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills</Text>
          <Text style={styles.skills}>{data.skills.join(" · ")}</Text>
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
            <Text style={styles.entryCompany}>{data.education.school}</Text>
          </View>
        </View>
      )}
    </Page>
  </Document>
);

// Download function — call this from any button
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