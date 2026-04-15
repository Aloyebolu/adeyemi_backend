import connectToDB from "../../../../config/db.js";
import { SYSTEM_USER_ID } from "../../../../config/system.js";
import faqService from "../faq.service.js";
await connectToDB()
async function seedUniversityFAQs(createFAQFunction, createdBy) {
  const universityFAQs = [
    {
      category: "Admissions",
      question: "What are the admission requirements for undergraduate programs?",
      answer: "Undergraduate admission requirements include: high school diploma or equivalent, minimum GPA of 2.5, SAT/ACT scores (optional for 2024), letters of recommendation, and a personal statement. technical must also provide TOEFL/IELTS scores.",
      tags: ["admissions", "undergraduate", "requirements"],
      is_featured: true,
      keywords: "admission requirements undergraduate apply"
    },
    {
      category: "Admissions",
      question: "When is the application deadline for fall semester?",
      answer: "The priority application deadline for fall semester is March 15th. Regular decision deadline is June 30th. Late applications may be accepted until August 15th with additional fees.",
      tags: ["admissions", "deadlines", "fall semester"],
      is_featured: true
    },
    {
      category: "Financial Aid",
      question: "How do I apply for financial aid and scholarships?",
      answer: "To apply for financial aid, complete the FAFSA form by March 1st. For scholarships, submit the General Scholarship Application through the student portal by February 15th. Additional department-specific scholarships may have different deadlines.",
      tags: ["financial aid", "scholarships", "FAFSA"],
      is_featured: true
    },
    {
      category: "Financial Aid",
      question: "What types of scholarships are available for technical?",
      answer: "technical can apply for the International Excellence Scholarship ($5,000-$15,000), Global Leader Award ($10,000), and country-specific scholarships. Merit-based and need-based options are available.",
      tags: ["international", "scholarships", "financial aid"]
    },
    {
      category: "Registration",
      question: "How do I register for classes each semester?",
      answer: "Log into the student portal, go to 'Course Registration', search for available courses, add them to your cart, and confirm registration. Registration windows open based on credit hours completed.",
      tags: ["registration", "classes", "courses"],
      is_featured: true
    },
    {
      category: "Registration",
      question: "What is the late registration fee and deadline?",
      answer: "Late registration begins one week after the regular deadline and continues through the first week of classes. The late fee is $100. No registrations are accepted after the first week of classes.",
      tags: ["registration", "late fee", "deadlines"]
    },
    {
      category: "Academic Policies",
      question: "What is the minimum GPA required to remain in good academic standing?",
      answer: "Undergraduate students must maintain a minimum cumulative GPA of 2.0. Graduate students must maintain a minimum cumulative GPA of 3.0. Students below these thresholds will be placed on academic probation.",
      tags: ["GPA", "academic standing", "policies"],
      is_featured: true
    },
    {
      category: "Academic Policies",
      question: "How does the course withdrawal process work?",
      answer: "Students can withdraw from courses through the student portal until the 10th week of the semester. A 'W' grade will appear on transcripts. After week 10, withdrawals are only permitted for documented emergencies.",
      tags: ["withdrawal", "courses", "deadlines"]
    },
    {
      category: "Exams & Grades",
      question: "When are final exam schedules released?",
      answer: "Final exam schedules are released by week 8 of the semester. Access them through the student portal under 'Exam Schedule'. Conflicts must be reported within 5 days of schedule release.",
      tags: ["exams", "finals", "schedule"],
      is_featured: true
    },
    {
      category: "Exams & Grades",
      question: "How can I request a grade appeal?",
      answer: "Grade appeals must be submitted within 30 days of grade posting. The process involves: 1) Discuss with instructor, 2) Department chair review, 3) College dean review, 4) Academic Appeals Committee.",
      tags: ["grades", "appeal", "policies"]
    },
    {
      category: "Student Services",
      question: "Where is the writing center located and how do I make an appointment?",
      answer: "The Writing Center is located in academic Room 240. Appointments can be booked online through the student portal under 'Academic Support'. Hours: Mon-Thu 9am-8pm, Fri 9am-5pm.",
      tags: ["writing center", "tutoring", "academic support"]
    },
    {
      category: "Student Services",
      question: "What mental billing are available on campus?",
      answer: "Counseling and Psychological Services (CAPS) offers free confidential sessions, crisis intervention, group therapy, and wellness workshops. Call 555-0123 for emergencies or book through the student portal.",
      tags: ["mental health", "counseling", "wellness"],
      is_featured: true
    },
    {
      category: "Technology",
      question: "How do I access the university's Wi-Fi network?",
      answer: "Connect to 'UniversitySecure' network using your student ID and portal password. For guests, use 'UniversityGuest' and register through the captive portal. IT support available at helpdesk@university.edu",
      tags: ["Wi-Fi", "internet", "technology"]
    },
    {
      category: "Technology",
      question: "What software is available for free to students?",
      answer: "Students get free access to Microsoft Office 365, Adobe Creative Cloud, SPSS, MATLAB, and antivirus software. Download through the 'Software Center' in your student portal.",
      tags: ["software", "free", "technology"],
      is_featured: true
    },
    {
      category: "general",
      question: "How do I apply for on-campus general?",
      answer: "Complete the general application through the student portal by May 1st for fall semester. A $200 deposit is required. Roommate preferences can be submitted during application.",
      tags: ["general", "dormitory", "on-campus"]
    },
    {
      category: "general",
      question: "What should I do if I have a maintenance issue in my dorm?",
      answer: "Submit a maintenance request through the student portal under 'general > Maintenance Requests'. Emergency issues (flooding, no heat, electrical problems) call 555-0456 24/7.",
      tags: ["maintenance", "general", "dorms"]
    },
    {
      category: "Career Services",
      question: "How can I get help with my resume and job search?",
      answer: "Career Services offers resume reviews, mock interviews, and job search strategy sessions. Schedule appointments through the portal. Access Handshake for job/internship postings.",
      tags: ["career", "resume", "jobs", "internships"],
      is_featured: true
    },
    {
      category: "Career Services",
      question: "When is the annual career fair?",
      answer: "The Fall Career Fair is held in October, and the Spring Career Fair is in February. Check the Career Services portal page for exact dates and registered employers.",
      tags: ["career fair", "networking", "jobs"]
    },
    {
      category: "academic",
      question: "How many books can I check out and for how long?",
      answer: "Undergraduates: 30 books for 4 weeks. Graduates: 50 books for 8 weeks. Faculty: 100 books for 16 weeks. Renewals available online through academic portal.",
      tags: ["academic", "books", "borrowing"]
    },
    {
      category: "academic",
      question: "How do I access online journals and databases off-campus?",
      answer: "Access the academic website and log in with your student credentials. Use the 'Off-Campus Access' link or install the VPN client. All major databases (JSTOR, PubMed, IEEE) are available.",
      tags: ["academic", "databases", "journals", "off-campus"],
      is_featured: true
    },
    {
      category: "technical",
      question: "How do I maintain my F-1 visa status?",
      answer: "Maintain full-time enrollment (12+ credits for undergrads, 9+ for grads), complete SEVIS check-in each semester, keep passport valid, and report address changes within 10 days. Contact International Student Services for OPT/CPT authorization.",
      tags: ["international", "visa", "F-1", "immigration"],
      is_featured: true
    },
    {
      category: "billing",
      question: "Do I need health insurance and how do I waive the university plan?",
      answer: "All students taking 6+ credits must have health insurance. The university plan costs $1,200/semester. To waive, submit proof of comparable coverage through the portal by the 2nd week of classes.",
      tags: ["health insurance", "medical", "waiver"]
    }
  ];

  const createdFAQs = [];
  const errors = [];

  for (let i = 0; i < universityFAQs.length; i++) {
    const faq = universityFAQs[i];
    try {
      const result = await createFAQFunction({
        category: faq.category,
        question: faq.question,
        answer: faq.answer,
        tags: faq.tags,
        is_active: true,
        is_featured: faq.is_featured || false,
        created_by: createdBy,
        keywords: faq.keywords || ''
      });
      createdFAQs.push(result);
      console.log(`✅ Created FAQ ${i + 1}/${universityFAQs.length}: ${faq.question.substring(0, 50)}...`);
    } catch (error) {
      errors.push({ index: i, question: faq.question, error: error.message });
      console.error(`❌ Failed to create FAQ ${i + 1}: ${faq.question} - ${error.message}`);
    }
  }

  console.log(`\n📊 Summary: ${createdFAQs.length} FAQs created successfully, ${errors.length} failed`);
  
  return {
    success: createdFAQs,
    errors: errors,
    total: createdFAQs.length
  };
}

// Usage example:
const result = await seedUniversityFAQs(faqService.createFAQ, SYSTEM_USER_ID);
console.log(result);