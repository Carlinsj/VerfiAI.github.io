import React from "react";
import { Link } from "react-router-dom";
import "../styles/HomeScreen.css";
import "../styles/Contact.css";
import NavigationHeader from "../components/NavigationHeader";

const MemberCard = ({ name, description, email, icon }) => {
  return (
    <div className="member-card">
      <div className="member-icon">{icon}</div>
      <h3>{name}</h3>
      <p>{description}</p>
      <a href={`mailto:${email}`} className="member-email">{email}</a>
    </div>
  );
};

const ContactPage = () => {
  return (
    <div className="page-container">
      <NavigationHeader />
      
      <div className="contact-section">
        <div className="contact-header">
          <h1>Drop us a line</h1>
          <div className="logo-container">
            <h1 className="logo-text">V<span className="dot">.</span>ai</h1>
          </div>
        </div>
        
        <div className="contact-description">
          <p>Questions, feedback, or collaboration? We'd love to hear from you.</p>
        </div>
        
        <div className="team-members">
          <MemberCard 
            name="Frank Li"
            description="3rd year Computer Science and Engineering student. I like to lift, play poker, and guitar."
            email="frank.li.865985@gmail.com"
            icon={<span role="img" aria-label="guitar">🎸</span>}
          />
          
          <MemberCard 
            name="Shashank Raghuraj"
            description="3rd year Computer Science and Engineering major. I spend my free time watching tv shows."
            email="shashankraghuraj12@gmail.com"
            icon={<span role="img" aria-label="computer">🖥️</span>}
          />
          
          <MemberCard 
            name="Charlie McEwen"
            description="4th year Computer Science and Engineering student. I spend most of my free time either rock climbing or cooking."
            email="cmcewen2017@gmail.com"
            icon={<span role="img" aria-label="climbing">🧗</span>}
          />
          
          <MemberCard 
            name="Akshaya Narayanasamy"
            description="3rd year PhD student in chemistry department working in the area of Computational Biochemistry."
            email="akshaya.researcher@gmail.com"
            icon={<span role="img" aria-label="science">🧪</span>}
          />
          
          <MemberCard 
            name="Carlin Joseph"
            description="4th year Computer Science and Computing student. I enjoy playing the guitar, singing and playing various sports."
            email="carlinsjoseph17@gmail.com"
            icon={<span role="img" aria-label="guitar">🎸</span>}
          />
          
          <MemberCard 
            name="Xihao (Fred) Lu"
            description="2nd year master student in Electrical and Computer Engineering major. I like photography during my free time."
            email="loaddor@gmail.com"
            icon={<span role="img" aria-label="chip">🖥️</span>}
          />
        </div>
        
        <div className="github-section">
          <p>
            <span role="img" aria-label="github">🔴</span> GitHub:{" "}
            <a href="https://github.com/VerifAI-ai/VerifAI" target="_blank" rel="noopener noreferrer">
              VerifAI GitHub Repo
            </a>
          </p>
        </div>
        
        <div className="footer-message">
          <p>Free to use, free to improve. Join the community</p>
        </div>
      </div>
    </div>
  );
};

export default ContactPage; 