import React, { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { firebaseApp } from "../firebase-config";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  onSnapshot,
  deleteDoc,
  getDocs,
} from "firebase/firestore";
import axios from "axios";
import NavigationHeader from "../components/NavigationHeader";
import { useAuth } from "../contexts/authContext";
import "../styles/ReferenceVerification.css";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

const VerificationStatsButton = ({ references, user, saveReferenceToFirestore }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [verificationStats, setVerificationStats] = useState({
    verified: 0,
    notVerified: 0,
    unverifiable: 0,
    unverifiableRefs: [],
    loading: false
  });
  const [verificationResults, setVerificationResults] = useState([]);

  const verifyAllReferences = async () => {
    setVerificationStats(prev => ({ ...prev, loading: true }));
    
    // TEMPORARILY: Always use production endpoint for testing
    const apiBaseUrl = "https://verfiai.uc.r.appspot.com";

    console.log("Environment:", { 
      hostname: window.location.hostname,
      apiBaseUrl
    });

    const results = await Promise.all(
      references.map(async (reference) => {
        try {
          const response = await axios.post(`${apiBaseUrl}/api/verify-reference`, {
            reference
          });
          return {
            reference,
            status: response.data.verification_status
          };
        } catch (error) {
          console.error('Error verifying reference:', error);
          return {
            reference,
            status: 'failed'
          };
        }
      })
    );

    setVerificationResults(results);

    const stats = results.reduce((acc, { status, reference }) => {
      if (status === 'verified') acc.verified++;
      else if (status === 'not_found' || status === 'failed') {
        acc.unverifiable++;
        acc.unverifiableRefs.push(reference);
      }
      else acc.notVerified++;
      return acc;
    }, { verified: 0, notVerified: 0, unverifiable: 0, unverifiableRefs: [] });

    setVerificationStats({ ...stats, loading: false });
  };

  const chartData = {
    labels: ['Verified', 'Not Verified', 'Unverifiable'],
    datasets: [{
      data: [
        verificationStats.verified,
        verificationStats.notVerified,
        verificationStats.unverifiable
      ],
      backgroundColor: [
        'rgba(75, 192, 192, 0.6)',
        'rgba(255, 206, 86, 0.6)',
        'rgba(255, 99, 132, 0.6)'
      ],
      borderColor: [
        'rgba(75, 192, 192, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(255, 99, 132, 1)'
      ],
      borderWidth: 1
    }]
  };

  const handleChartClick = async (event, elements) => {
    if (!elements || !elements.length) return;
    
    const clickedIndex = elements[0].index;
    // 0 = Verified, 1 = Not Verified, 2 = Unverifiable
    if (clickedIndex === 0) { // Only handle clicks on the "Verified" section
      const verifiedRefs = references.filter((ref) => {
        const result = verificationResults.find(vr => 
          vr.reference.title === ref.title && 
          vr.reference.doi === ref.doi
        );
        return result && result.status === 'verified';
      });
      
      // Save all verified references to Firestore
      for (const ref of verifiedRefs) {
        const citationData = {
          title: ref.title || "Untitled Reference",
          authors: ref.authors || [],
          year: ref.year || null,
          doi: ref.doi || null,
          research_field: { field: "Reference" },
          is_retracted: false
        };
        await saveReferenceToFirestore(citationData, user.userID);
      }
    }
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
      },
      title: {
        display: true,
        text: 'Reference Verification Status',
        color: '#333',
        font: { size: 16 }
      }
    },
    onClick: handleChartClick
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onMouseEnter={() => {
          setIsHovered(true);
          if (!verificationStats.verified && !verificationStats.loading) {
            verifyAllReferences();
          }
        }}
        onMouseLeave={() => !isOpen && setIsHovered(false)}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!verificationStats.verified && !verificationStats.loading) {
            verifyAllReferences();
          }
        }}
        style={{
          background: '#6E44FF',
          color: 'white',
          border: 'none',
          padding: '0.5rem',
          borderRadius: '50%',
          width: '30px',
          height: '30px',
          cursor: 'pointer',
          marginLeft: '10px'
        }}
      >
        📊
      </button>

      {/* Hover preview */}
      {isHovered && !isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'white',
          padding: '1rem',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          zIndex: 1000,
          width: '200px'
        }}>
          <div style={{ textAlign: 'center' }}>
            {verificationStats.loading ? (
              <p>Verifying references...</p>
            ) : (
              <p>Click to see full verification details</p>
            )}
          </div>
        </div>
      )}

      {/* Full modal when clicked */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          zIndex: 1000,
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto'
        }}>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>

          {verificationStats.loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>Verifying references...</p>
            </div>
          ) : (
            <>
              <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                <Pie data={chartData} options={options} />
              </div>
              
              <div style={{ marginTop: '2rem' }}>
                <h4>Verification Summary</h4>
                <p>Total References: {references.length}</p>
                <p>Verified: {verificationStats.verified}</p>
                <p>Not Verified: {verificationStats.notVerified}</p>
                <p>Unverifiable: {verificationStats.unverifiable}</p>

                {verificationStats.unverifiableRefs.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <h4>Unverifiable Citations:</h4>
                    <ul style={{ 
                      listStyle: 'none', 
                      padding: 0,
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {verificationStats.unverifiableRefs.map((ref, idx) => (
                        <li key={idx} style={{
                          padding: '0.5rem',
                          margin: '0.5rem 0',
                          background: '#fff5f5',
                          borderRadius: '4px'
                        }}>
                          <strong>{ref.title || 'Untitled Reference'}</strong>
                          {ref.authors && (
                            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                              Authors: {Array.isArray(ref.authors) ? ref.authors.join(', ') : ref.authors}
                            </p>
                          )}
                          {ref.year && <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>Year: {ref.year}</p>}
                          {ref.doi && (
                            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                              DOI: <a href={`https://doi.org/${ref.doi}`} target="_blank" rel="noopener noreferrer">{ref.doi}</a>
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const ReferenceItem = ({ reference, index, userID }) => {
  const [verificationStatus, setVerificationStatus] = useState(
    reference.verification_status || "pending"
  );
  const [results, setResults] = useState(null);

  const verifyReference = async () => {
    try {
      setVerificationStatus("in_progress");

      // TEMPORARILY: Always use production endpoint for testing
      const apiBaseUrl = "https://verfiai.uc.r.appspot.com";

      const response = await axios.post(`${apiBaseUrl}/api/verify-reference`, {
        reference,
      });

      setVerificationStatus(response.data.verification_status);
      setResults(response.data.results);
    } catch (error) {
      console.error("Error verifying reference:", error);
      setVerificationStatus("failed");
    }
  };

  const saveReferenceToFirestore = async (ref, userID) => {
    if (!userID) return; // Safety check

    try {
      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", userID);
      const citationsRef = collection(userRef, "citations");

      const newCitation = {
        title: ref.title || ref.unstructured || "Untitled Reference",
        authors: ref.authors || [],
        year: ref.year || null,
        doi: ref.doi || null,
        userID: userID,
        timestamp: new Date(),
      };

      await addDoc(citationsRef, newCitation);
      console.log("Reference saved to Firestore!");
    } catch (error) {
      console.error("Error saving reference:", error);
    }
  };

  // Status indicator configurations
  const statusInfo = {
    pending: { icon: "⚪", text: "Not Verified" },
    in_progress: { icon: "🔄", text: "Verifying..." },
    verified: { icon: "✅", text: "Verified" },
    not_found: { icon: "⚠️", text: "Not Found" },
    failed: { icon: "❌", text: "Verification Failed" },
    retracted: { icon: "🚫", text: "Retracted" },
  };

  const status = statusInfo[verificationStatus] || statusInfo.pending;

  return (
    <li className="reference-item">
      <div className="reference-header">
        <div className="reference-content">
          <p className="reference-title">
            [{index + 1}] {reference.title || reference.unstructured || "Untitled Reference"}
          </p>
          {reference.authors && reference.authors.length > 0 && (
            <p className="reference-authors">
              {Array.isArray(reference.authors)
                ? reference.authors.join(", ")
                : reference.authors}
            </p>
          )}
          {reference.year && <p className="reference-year">Year: {reference.year}</p>}
          {reference.doi && (
            <p className="reference-doi">
              DOI:{" "}
              <a
                href={`https://doi.org/${reference.doi}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {reference.doi}
              </a>
            </p>
          )}
          {reference.similarity_percentage !== undefined && (
    <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#333' }}>
      Relatability: {reference.similarity_percentage}%
    </p>
  )}

  
        </div>

        <div className="reference-status-container">
          <div className={`status-badge status-${verificationStatus}`}>
            <span className="status-icon">{status.icon}</span>
            <span className="status-text">{status.text}</span>
          </div>

          {/* Verify Button (only if pending) */}
          {verificationStatus === "pending" && (
            <button onClick={verifyReference} className="verify-button">
              Verify
            </button>
          )}

          {/* Save Button (only if verified) */}
          {verificationStatus === "verified" && (
            <button
              onClick={() => saveReferenceToFirestore(reference, userID)}
              className="verify-button"
              disabled={!userID}
            >
              Save
            </button>
          )}
        </div>
      </div>

      {/* Verification results */}
      {results && verificationStatus !== "failed" && verificationStatus !== "pending" && (
        <div className="results-container">
          <p className="results-heading">Verification Results:</p>

          {results.crossref && results.crossref.length > 0 && (
            <div className="results-section">
              <p className="results-section-title">Found on CrossRef:</p>
              <ul className="results-list">
                {results.crossref.map((item, idx) => (
                  <li key={idx} className="results-item">
                    <strong>{item.title}</strong>
                    {item.publisher && <span> - {item.publisher}</span>}
                    {item.year && <span> ({item.year})</span>}
                    <br />
                    <a
                      href={`https://doi.org/${item.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      DOI: {item.doi}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {results.arxiv && results.arxiv.length > 0 && (
            <div className="results-section">
              <p className="results-section-title">Found on ArXiv:</p>
              <ul className="results-list">
                {results.arxiv.map((item, idx) => (
                  <li key={idx} className="results-item">
                    <a href={item.link} target="_blank" rel="noopener noreferrer">
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {results.semantic_scholar && results.semantic_scholar.length > 0 && (
            <div className="results-section">
              <p className="results-section-title">Found on Semantic Scholar:</p>
              <ul className="results-list">
                {results.semantic_scholar.map((item, idx) => (
                  <li key={idx} className="results-item">
                    <a
                      href={`https://www.semanticscholar.org/paper/${item.paperId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {results.retracted && results.retracted.length > 0 && (
            <div className="results-section">
              <p className="results-section-title retracted-title">
                Retraction Information:
              </p>
              <ul className="results-list">
                {results.retracted.map((item, idx) => (
                  <li key={idx} className="results-item">
                    <span className="retracted-title">{item.title}</span> -{" "}
                    <a
                      href={`https://doi.org/${item.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      DOI: {item.doi}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {((results.crossref && results.crossref.length === 0) &&
            (results.arxiv && results.arxiv.length === 0) &&
            (results.semantic_scholar && results.semantic_scholar.length === 0) &&
            (results.retracted && results.retracted.length === 0)) && (
            <p className="not-found-message">
              This reference was not found in any of the searched databases.
            </p>
          )}
        </div>
      )}
    </li>
  );
};

const Chat = () => {
  const [messages, setMessages] = useState([
    {
      type: "bot",
      text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const user = useAuth(); // Retrieve the current user's UID
  const [citations, setCitations] = useState([]);

  // Listen for real-time updates to citations
  useEffect(() => {
    const fetchCitations = () => {
      if (!user || !user.userID) return;

      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", user.userID);
      const citationsRef = collection(userRef, "citations");

      // Listen for real-time updates
      const unsubscribe = onSnapshot(citationsRef, (querySnapshot) => {
        // Include Firestore doc ID
        const citationsData = querySnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        setCitations(citationsData);
      });

      return () => unsubscribe();
    };

    // This effect will run whenever the user changes
    fetchCitations();
  }, [user]);

  const handleLogout = async () => {
    const auth = getAuth(firebaseApp);
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Basic ISBN validation
  const isISBN = (input) => {
    return /^(?:\d{10}|\d{13})$/.test(input.replace(/-/g, ""));
  };

  // ---- FILE UPLOAD FUNCTIONS (from main) ----
  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadedFile(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const uploadDocument = async () => {
    if (!uploadedFile) return;

    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      {
        type: "user",
        text: `Uploading document: ${uploadedFile.name}`,
      },
    ]);

    const formData = new FormData();
    formData.append("file", uploadedFile);

    // TEMPORARILY: Always use production endpoint for testing
    const apiBaseUrl = "https://verfiai.uc.r.appspot.com";

    try {
      const response = await axios.post(`${apiBaseUrl}/api/upload-document`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });

      const documentData = response.data;

      // Format the document analysis results
      const formattedMessage = (
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <h3 style={{ margin: 0 }}>Document Analysis</h3>
            <VerificationStatsButton 
              references={documentData.references ? documentData.references.map(ref => ({ 
                title: ref,
                unstructured: ref 
              })) : []} 
              user={user}
              saveReferenceToFirestore={saveCitationToFirestore}
            />
          </div>
          <p>
            <b>📄 File Name:</b> {documentData.file_name || uploadedFile.name}
          </p>
          <p>
            <b>📋 File Type:</b>{" "}
            {documentData.file_type || uploadedFile.name.split(".").pop()}
          </p>

          {documentData.metadata && (
            <div>
              <h4>Metadata</h4>
              {documentData.metadata.title && (
                <p>
                  <b>Title:</b> {documentData.metadata.title}
                </p>
              )}
              {documentData.metadata.authors && (
                <div>
                  <p>
                    <b>Authors:</b>
                  </p>
                  <ul style={{ paddingLeft: "2rem" }}>
                    {documentData.metadata.authors.map((author, idx) => (
                      <li key={idx}>{author}</li>
                    ))}
                  </ul>
                </div>
              )}
              {documentData.metadata.abstract && (
                <p>
                  <b>Abstract:</b> {documentData.metadata.abstract}
                </p>
              )}
              {documentData.metadata.keywords && (
                <p>
                  <b>Keywords:</b> {documentData.metadata.keywords.join(", ")}
                </p>
              )}
            </div>
          )}

          {documentData.citation_style && (
            <p>
              <b>Citation Style:</b> {documentData.citation_style}
            </p>
          )}

          {documentData.references && documentData.references.length > 0 && (
            <div className="references-container">
              <h4 className="references-title">
                References ({documentData.references.length})
              </h4>
              <ul className="references-list">
                {documentData.references.map((ref, idx) => (
                  <ReferenceItem
                    key={idx}
                    reference={{ unstructured: ref }}
                    index={idx}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      );

      setMessages((prev) => [...prev, { type: "bot", text: formattedMessage }]);

      // Save to Firestore if there's valid metadata
      if (
        user &&
        user.userID &&
        documentData.metadata &&
        documentData.metadata.title
      ) {
        await saveCitationToFirestore(
          {
            title: documentData.metadata.title,
            authors: documentData.metadata.authors || [],
            research_field: { field: "Document Upload" },
            year: new Date().getFullYear().toString(),
            doi: "N/A",
            is_retracted: false,
          },
          user.userID
        );
      }

      // Reset file input
      setUploadedFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      setMessages((prev) => [
        ...prev,
        {
          type: "bot",
          text: "Error analyzing the document. Please check the file format and try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ---- END FILE UPLOAD FUNCTIONS ----

  // Search a paper by DOI/Title/ISBN
  const searchPaper = async () => {
    if (input.trim() === "") return;

    if (input.trim().toLowerCase() === "clear") {
      setMessages([
        {
          type: "bot",
          text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis.",
        },
      ]);
      setInput("");
      return;
    }

    setMessages((prev) => [...prev, { type: "user", text: input }]);
    setIsLoading(true);

    try {
      // TEMPORARILY: Always use production endpoint for testing
      const apiBaseUrl = "https://verfiai.uc.r.appspot.com";
      
      console.log("Search Paper Environment:", { 
        hostname: window.location.hostname,
        apiBaseUrl
      });

      const response = await axios.post(`${apiBaseUrl}/api/analyze-paper`, {
        doi: input,
      });
      const paper = response.data.paper;
      console.log("Received paper:", paper);

      let retractionNotice = paper.is_retracted ? (
        <div>
          <p style={{ color: "red", fontWeight: "bold" }}>🚨 This paper may be retracted!</p>
          <ul style={{ paddingLeft: "2rem" }}>
            {paper.retraction_info.map((item, idx) => (
              <li key={idx} style={{ marginBottom: "0.5rem" }}>
                <b>📌 Title:</b> {item.title}
                <br />
                <b>🔗 DOI:</b> {item.doi}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p style={{ color: "green" }}>✅ This paper does not appear to be retracted.</p>
      );

      const references = (
        <div className="references-container">
          <h4 className="references-title">
            References{" "}
            {paper.references && paper.references.length > 0
              ? `(${paper.references.length})`
              : ""}
          </h4>
          {paper.references && paper.references.length > 0 ? (
            <ul className="references-list">
              {paper.references.map((ref, idx) => (
                <ReferenceItem
                  key={idx}
                  reference={ref}
                  index={idx}
                  userID={user && user.userID}
                />
              ))}
            </ul>
          ) : (
            <p>No references available for this paper.</p>
          )}
        </div>
      );

      const formattedMessage = (
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <h3 style={{ margin: 0 }}>Paper Details</h3>
            <VerificationStatsButton 
              references={paper.references || []} 
              user={user}
              saveReferenceToFirestore={saveCitationToFirestore}
            />
          </div>
          <p>
            <b>📌 Title:</b> {paper.title}
          </p>
          <p>
            <b>👥 Authors:</b>
          </p>
          <ul style={{ paddingLeft: "2rem" }}>
            {paper.authors.map((author, index) => (
              <li key={index} style={{ marginBottom: "0.3rem" }}>
                {author}
              </li>
            ))}
          </ul>
          <p>
            <b>📊 Research Field:</b> {paper.research_field?.field || "Unspecified"}
          </p>
          <p>
            <b>📅 Year:</b> {paper.year}
          </p>
          <p>
            <b>🔗 DOI:</b> {paper.doi}
          </p>
          {retractionNotice}
          {references}
        </div>
      );

      setMessages((prev) => [...prev, { type: "bot", text: formattedMessage }]);

    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          type: "bot",
          text: "Error analyzing paper. Please check the DOI and try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      setInput("");
    }
  };

  // Save any paper-like object to Firestore
  const saveCitationToFirestore = async (paper, userID) => {
    if (!userID) return;

    try {
      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", userID);
      const citationsRef = collection(userRef, "citations");

      const newCitation = {
        title: paper.title,
        authors: paper.authors,
        research_field: paper.research_field.field,
        year: paper.year,
        doi: paper.doi,
        retracted: paper.is_retracted,
        userID: userID,
        timestamp: new Date(),
      };

      await addDoc(citationsRef, newCitation);
      console.log("Citation saved to Firestore!");
    } catch (error) {
      console.error("Error saving citation:", error);
    }
  };

  // Delete a citation by ID
  const deleteCitation = async (citationId) => {
    if (!user || !user.userID) return;
    try {
      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", user.userID);
      const citationDocRef = doc(userRef, "citations", citationId);
      await deleteDoc(citationDocRef);
      console.log("Citation deleted successfully!");
    } catch (error) {
      console.error("Error deleting citation:", error);
    }
  };

  // Press Enter to search
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      searchPaper();
    }
  };

  const deleteAllCitations = async () => {
    if (!user || !user.userID) return;
    
    try {
      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", user.userID);
      const citationsRef = collection(userRef, "citations");
      
      // Get all citations
      const snapshot = await getDocs(citationsRef);
      
      // Delete each citation
      const deletePromises = snapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      
      await Promise.all(deletePromises);
      console.log("All citations deleted successfully!");
    } catch (error) {
      console.error("Error deleting all citations:", error);
    }
  };

  return (
    <>
      <NavigationHeader />

      <Helmet>
        <title>Research Paper Validator - VerifAI</title>
        <meta name="description" content="Validate and cite research papers" />
        <style>
          {`
            body {
              margin-top: 6rem;
              margin: 0;
              padding: 0;
              background-color: #E6E6FA;
              height: 100vh;
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            }
            @keyframes loading {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(400%); }
            }
            .file-upload-container {
              display: flex;
              align-items: center;
              margin-bottom: 1rem;
            }
            .file-upload-button {
              background: #6E44FF;
              color: white;
              border: none;
              padding: 0.5rem 1rem;
              border-radius: 8px;
              cursor: pointer;
              font-size: 0.9rem;
              margin-right: 0.5rem;
            }
            .file-name {
              margin-left: 0.5rem;
              font-size: 0.9rem;
              color: #555;
            }
            .upload-progress {
              height: 4px;
              background: #f0f0f0;
              border-radius: 2px;
              margin-top: 0.5rem;
              overflow: hidden;
            }
            .upload-progress-bar {
              height: 100%;
              background: #6E44FF;
              border-radius: 2px;
              transition: width 0.3s ease;
            }
          `}
        </style>
      </Helmet>

      <div
        style={{
          display: "flex",
          height: "100vh",
          margin: "0 auto",
          background: "white",
          boxShadow: "0 0 10px rgba(0,0,0,0.1)",
        }}
      >
        {/* Sidebar */}
        <div
          style={{
            marginTop: "6rem",
            width: "300px",
            height: "100vh",
            backgroundColor: "#e5e5e5",
            color: "white",
            padding: "1.5rem 1rem",
            display: "flex",
            flexDirection: "column",
            position: "fixed",
            top: "0",
            left: "0",
            bottom: "0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem"
            }}
          >
            <h1
              style={{
                margin: 0,
                background: "linear-gradient(270deg, #6E44FF, #FF4D4D)",
                backgroundSize: "200% auto",
                color: "transparent",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                animation: "gradient-animation 10s ease infinite",
                fontSize: "1.5rem",
              }}
            >
              Citations
            </h1>
            {citations.length > 0 && (
              <button
                onClick={deleteAllCitations}
                style={{
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  padding: "0.4rem 0.8rem",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.8rem"
                }}
              >
                Delete All
              </button>
            )}
          </div>

          <div
            style={{
              marginTop: "1rem",
              paddingTop: "0.5rem",
              overflowY: "auto",
              maxHeight: "85%",
            }}
          >
            {citations.length > 0 ? (
              citations.map((citation, idx) => (
                <div
                  key={citation.id}
                  style={{
                    marginBottom: "1rem",
                    background: "#fff",
                    padding: "0.5rem",
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                >
                  <p style={{ color: "#333" }}>
                    <b>{citation.title}</b>
                  </p>
                  <p style={{ color: "#555" }}>
                    {citation.authors && Array.isArray(citation.authors)
                      ? citation.authors.join(", ")
                      : "No authors available"}
                  </p>
                  <p style={{ color: "#555" }}>Year: {citation.year}</p>
                  {citation.doi && (
                    <p>
                      <a
                        href={`https://doi.org/${citation.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        DOI
                      </a>
                    </p>
                  )}

                  {/* DELETE BUTTON */}
                  <button
                    onClick={() => deleteCitation(citation.id)}
                    style={{
                      marginTop: "0.5rem",
                      backgroundColor: "#dc3545",
                      color: "white",
                      border: "none",
                      padding: "0.4rem 0.8rem",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))
            ) : (
              <p>No citations saved yet!</p>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div
          style={{
            marginTop: "6rem",
            marginLeft: "300px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "1rem",
          }}
        >
          {/* Chat Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
            ref={messagesEndRef}
          >
            {messages.map((message, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent:
                    message.type === "user" ? "flex-end" : "flex-start",
                  padding: "0.5rem 1rem",
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "1rem",
                    borderRadius: "12px",
                    background: message.type === "user" ? "#6E44FF" : "#f7f7f8",
                    color: message.type === "user" ? "white" : "#333",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                >
                  {message.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div
                style={{
                  padding: "1rem",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: "80%",
                    height: "4px",
                    background: "#f0f0f0",
                    borderRadius: "2px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: "30%",
                      height: "100%",
                      background: "#6E44FF",
                      animation: "loading 1s infinite linear",
                      borderRadius: "2px",
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Search Bar + File Upload Section */}
          <div
            style={{
              padding: "1rem",
              borderTop: "1px solid #e5e5e5",
              background: "white",
            }}
          >
            {/* File Upload Controls */}
            <div className="file-upload-container">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: "none" }}
                accept=".pdf,.docx,.txt"
              />
              <button className="file-upload-button" onClick={triggerFileInput}>
                Upload Document
              </button>

              {uploadedFile && (
                <>
                  <span className="file-name">{uploadedFile.name}</span>
                  <button
                    className="file-upload-button"
                    onClick={uploadDocument}
                    style={{ marginLeft: "0.5rem" }}
                  >
                    Analyze
                  </button>
                </>
              )}
            </div>

            {/* Upload Progress Bar */}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="upload-progress">
                <div
                  className="upload-progress-bar"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            )}

            {/* Search Input for DOIs / Titles */}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                maxWidth: "800px",
                margin: "0 auto",
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter paper title, DOI, or ISBN..."
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "1px solid #e5e5e5",
                  fontSize: "1rem",
                  outline: "none",
                }}
              />
              <button
                onClick={searchPaper}
                style={{
                  background: "#FF4D4D",
                  color: "white",
                  border: "none",
                  padding: "0.75rem 1.5rem",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "1rem",
                  transition: "background-color 0.3s ease",
                }}
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Chat;
