const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const TeacherProfile = require('../models/TeacherProfile');
const TeachingAssignment = require('../models/TeachingAssignment');
const Class = require('../models/Class');
const Subject = require('../models/Subject');

async function inspectTeacher() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Locate teacher by Teacher ID and/or name
    const teacherProfile = await TeacherProfile.findOne({
      $or: [
        { teacherId: 't001' },
        { 'personalInfo.name': { $regex: /jogi\s*uma\s*devi/i } }
      ]
    }).populate('user', 'userId name email role isActive mustChangePassword createdAt');

    if (!teacherProfile) {
      console.log('Teacher profile NOT found for Jogi Uma Devi / t001');
      process.exit(1);
    }

    console.log('TeacherProfile found:');
    console.log({
      teacherProfileId: teacherProfile._id.toString(),
      teacherId: teacherProfile.teacherId,
      personalName: teacherProfile.personalInfo?.name,
      department: teacherProfile.department,
      designation: teacherProfile.designation,
      qualifications: teacherProfile.professionalInfo?.qualifications,
      yearsOfExperience: teacherProfile.professionalInfo?.yearsOfExperience,
      userRef: teacherProfile.user ? {
        _id: teacherProfile.user._id.toString(),
        userId: teacherProfile.user.userId,
        name: teacherProfile.user.name,
        email: teacherProfile.user.email,
        role: teacherProfile.user.role,
        isActive: teacherProfile.user.isActive,
        mustChangePassword: teacherProfile.user.mustChangePassword
      } : null
    });

    // Check teaching assignments
    const assignments = await TeachingAssignment.find({
      teacher: teacherProfile._id
    }).populate('subject', 'name code').populate('classRef', 'name section');

    console.log(`Found ${assignments.length} teaching assignments:`);
    assignments.forEach(a => {
      console.log(`- Subject: ${a.subject?.name} (${a.subject?.code}), Class/Section: ${a.classRef?.name} ${a.classRef?.section || ''}, Active: ${a.isActive}`);
    });

    // Check classes where this teacher might be class teacher
    const classTeacherSections = await Class.find({ classTeacher: teacherProfile._id });
    console.log(`Class Teacher for ${classTeacherSections.length} classes:`, classTeacherSections.map(s => `${s.name} ${s.section || ''}`));

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error during inspection:', err.message);
    process.exit(1);
  }
}

inspectTeacher();
