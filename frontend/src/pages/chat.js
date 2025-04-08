import React, { useState, useRef, useEffect, useContext } from "react";
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
  query,
  orderBy,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import axios from "axios";
import NavigationHeader from "../components/NavigationHeader";
import { useAuth } from "../contexts/authContext";
import "../styles/ReferenceVerification.css";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import ReactDOMServer from 'react-dom/server';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

const serializeMessage = (message) => {
  if (!message) return message;
  
  // If message.text is a React element (JSX), convert it to a special format
  if (React.isValidElement(message.text)) {
    return {
      ...message,
      text: JSON.stringify({
        __isReactElement: true,
        jsx: ReactDOMServer.renderToString(message.text)
      })
    };
  }
  
  // For objects that aren't React elements but aren't strings either
  if (typeof message.text === 'object' && message.text !== null) {
    return {
      ...message,
      text: JSON.stringify({
        __isObject: true,
        data: message.text
      })
    };
  }
  
  return message;
};

const deserializeMessage = (message) => {
  if (!message || typeof message.text !== 'string') return message;
  
  try {
    // Check if it might be a serialized object
    if (message.text.startsWith('{') && message.text.endsWith('}')) {
      const parsed = JSON.parse(message.text);
      
      // Handle React elements
      if (parsed.__isReactElement) {
        return {
          ...message,
          text: <div dangerouslySetInnerHTML={{ __html: parsed.jsx }} />
        };
      }
      
      // Handle regular objects
      if (parsed.__isObject) {
        return {
          ...message,
          text: parsed.data
        };
      }
    }
  } catch (e) {
    // If parsing fails, just return the original message
    console.log("Failed to parse message text:", e);
  }
  
  return message;
};

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
    
    const results = await Promise.all(
      references.map(async (reference) => {
        try {
          const response = await axios.post('http://localhost:3002/api/verify-reference', {
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
  const { activeChatId } = useContext(ChatContext);

  const verifyReference = async () => {
    try {
      setVerificationStatus("in_progress");

      const response = await axios.post("http://localhost:3002/api/verify-reference", {
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
    if (!activeChatId) {
      console.error("No active chat found to save reference");
      return;
    }

    try {
      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", userID);
      const citationsRef = collection(userRef, "chatSessions", activeChatId, "citations");

      const newCitation = {
        title: ref.title || ref.unstructured || "Untitled Reference",
        authors: ref.authors || [],
        year: ref.year || null,
        doi: ref.doi || null,
        userID: userID,
        timestamp: new Date(),
      };

      await addDoc(citationsRef, newCitation);
      console.log("Reference saved to chat citations!");
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

// Create a context to share active chat ID across components
const ChatContext = React.createContext({ activeChatId: null });

const Chat = () => {
  // Chat session state
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [showNewChatInput, setShowNewChatInput] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  
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

  // Auto-create a new chat when user is logged in but has no active chat
  useEffect(() => {
    const createInitialChat = async () => {
      if (user && user.userID && chatSessions.length === 0 && !activeChatId) {
        try {
          console.log("Trying to create initial chat");
          const db = getFirestore(firebaseApp);
          const userRef = doc(db, "users", user.userID);
          const chatSessionsRef = collection(userRef, "chatSessions");
          
          // Check if user already has chat sessions
          const snapshot = await getDocs(chatSessionsRef);
          if (snapshot.empty) {
            console.log("No existing chats found, creating first chat");
            // Create a new "Untitled" chat session
            const newChatRef = await addDoc(chatSessionsRef, {
              title: "Untitled",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              userID: user.userID
            });
            
            // Create initial message
            const messagesRef = collection(userRef, "chatSessions", newChatRef.id, "messages");
            await addDoc(messagesRef, {
              type: "bot",
              text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis.",
              timestamp: serverTimestamp()
            });
            
            console.log("Setting active chat to newly created:", newChatRef.id);
            setActiveChatId(newChatRef.id);
          } else {
            console.log("Found existing chats:", snapshot.size);
          }
        } catch (error) {
          console.error("Error creating initial chat session:", error);
        }
      }
    };
    
    createInitialChat();
  }, [user, user?.userID, chatSessions.length]);

  // Load chat sessions when user is authenticated
  useEffect(() => {
    if (!user || !user.userID) return;

    const db = getFirestore(firebaseApp);
    const userRef = doc(db, "users", user.userID);
    const chatSessionsRef = collection(userRef, "chatSessions");
    const chatSessionsQuery = query(chatSessionsRef, orderBy("updatedAt", "desc"));

    const unsubscribe = onSnapshot(chatSessionsQuery, (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log("Loaded chat sessions:", sessionsData.length);
      setChatSessions(sessionsData);
      
      // If no active chat but we have sessions, select the first one
      if (!activeChatId && sessionsData.length > 0) {
        console.log("Selecting first chat session:", sessionsData[0].id);
        setActiveChatId(sessionsData[0].id);
      }
    });

    return () => unsubscribe();
  }, [user, user?.userID]);

  // Load messages when active chat changes
  useEffect(() => {
    if (user && user.userID && activeChatId) {
      loadChatMessages();
      loadChatCitations();
    }
  }, [user, user?.userID, activeChatId]);

  // Load messages for the active chat session
  const loadChatMessages = async () => {
    if (!user || !user.userID || !activeChatId) {
      console.log("Cannot load messages - missing user or active chat");
      return;
    }

    try {
      console.log("Loading messages for chat:", activeChatId);
      const db = getFirestore(firebaseApp);
      const messagesRef = collection(db, "users", user.userID, "chatSessions", activeChatId, "messages");
      const messagesQuery = query(messagesRef, orderBy("timestamp", "asc"));
      
      const snapshot = await getDocs(messagesQuery);
      
      if (snapshot.empty) {
        console.log("No messages found, setting default welcome message");
        setMessages([{
          type: "bot",
          text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis."
        }]);
        return;
      }
      
      const loadedMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        return deserializeMessage({
          id: doc.id,
          type: data.type,
          text: data.text,
          timestamp: data.timestamp
        });
      });
      
      console.log(`Loaded ${loadedMessages.length} messages for chat ${activeChatId}`);
      setMessages(loadedMessages);
    } catch (error) {
      console.error("Error loading chat messages:", error);
    }
  };

  // Load citations for the active chat
  const loadChatCitations = async () => {
    if (!user || !user.userID || !activeChatId) return;

    try {
      const db = getFirestore(firebaseApp);
      const citationsRef = collection(db, "users", user.userID, "chatSessions", activeChatId, "citations");
      const citationsQuery = query(citationsRef, orderBy("timestamp", "desc"));
      
      const snapshot = await getDocs(citationsQuery);
      const citationsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`Loaded ${citationsData.length} citations for chat ${activeChatId}`);
      setCitations(citationsData);
    } catch (error) {
      console.error("Error loading chat citations:", error);
    }
  };

  // Create a new chat session
  const createNewChatSession = async (title = "Untitled", isAuto = false) => {
    if (!user || !user.userID) {
      if (!isAuto) alert("Please log in to save chat sessions.");
      return null;
    }

    try {
      console.log("Creating new chat session with title:", title);
      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", user.userID);
      const chatSessionsRef = collection(userRef, "chatSessions");
      
      const newChatRef = await addDoc(chatSessionsRef, {
        title: title,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        userID: user.userID
      });
      
      // Create initial message
      const messagesRef = collection(userRef, "chatSessions", newChatRef.id, "messages");
      await addDoc(messagesRef, {
        type: "bot",
        text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis.",
        timestamp: serverTimestamp()
      });
      
      // Only set the active chat ID if we're creating manually or don't have one already
      if (!isAuto || !activeChatId) {
        console.log("Setting active chat to newly created:", newChatRef.id);
        setActiveChatId(newChatRef.id);
      }
      
      // Clear input field and hide new chat input if showing
      if (!isAuto) {
        setNewChatTitle('');
        setShowNewChatInput(false);
      }
      
      return newChatRef.id;
    } catch (error) {
      console.error("Error creating new chat session:", error);
      if (!isAuto) alert("Error creating chat session. Please try again.");
      return null;
    }
  };

  // Delete a chat session
  const deleteChatSession = async (chatId) => {
    if (!user || !user.userID) return;

    if (window.confirm("Are you sure you want to delete this chat?")) {
      try {
        const db = getFirestore(firebaseApp);
        const chatRef = doc(db, "users", user.userID, "chatSessions", chatId);
        
        // Delete the chat document
        await deleteDoc(chatRef);
        
        // If the deleted chat was active, select another chat
        if (chatId === activeChatId) {
          // Find the next available chat
          const nextChat = chatSessions.find(chat => chat.id !== chatId);
          if (nextChat) {
            setActiveChatId(nextChat.id);
          } else {
            setActiveChatId(null);
            // Reset messages to default
            setMessages([{
              type: "bot",
              text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis."
            }]);
          }
        }
      } catch (error) {
        console.error("Error deleting chat session:", error);
        alert("Error deleting chat. Please try again.");
      }
    }
  };

  // Save messages to Firestore for the active chat
  const saveMessageToFirestore = async (message) => {
    if (!user || !user.userID) {
      console.log("User not logged in, not saving message");
      return;
    }
    
    let chatId = activeChatId;
    
    // If no active chat exists, create a new one
    if (!chatId) {
      console.log("No active chat, creating new chat before saving message");
      chatId = await createNewChatSession("Untitled", true);
      if (!chatId) {
        console.error("Failed to create new chat session");
        return;
      }
    }
    
    try {
      console.log(`Saving message to chat ${chatId}:`, message.type);
      const db = getFirestore(firebaseApp);
      const messagesRef = collection(db, "users", user.userID, "chatSessions", chatId, "messages");
      
      // Serialize the message properly before saving
      const serializedMessage = serializeMessage({
        ...message,
        timestamp: serverTimestamp()
      });
      
      await addDoc(messagesRef, serializedMessage);
      
      // Update the chat session's updatedAt timestamp
      const chatRef = doc(db, "users", user.userID, "chatSessions", chatId);
      await updateDoc(chatRef, {
        updatedAt: serverTimestamp()
      });
      
      console.log("Message saved successfully");
    } catch (error) {
      console.error("Error saving message to Firestore:", error);
    }
  };

  // Rename a chat session
  const renameChatSession = async (chatId, newTitle) => {
    if (!user || !user.userID) return;

    try {
      const db = getFirestore(firebaseApp);
      const chatRef = doc(db, "users", user.userID, "chatSessions", chatId);
      
      await updateDoc(chatRef, {
        title: newTitle,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error renaming chat session:", error);
      alert("Error renaming chat. Please try again.");
    }
  };

  // Function to handle paper search
  const searchPaper = async (e) => {
    e.preventDefault();
    
    // Check if input is empty or user is trying to clear the chat
    if (!input.trim() || input.toLowerCase() === "clear" || input.toLowerCase() === "reset") {
      setMessages([{
        type: "bot",
        text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis."
      }]);
      setInput("");
      
      // If user is logged in, save this reset to Firestore
      if (user && user.userID) {
        // Create new chat session if there's no active one
        if (!activeChatId) {
          const newChatId = await createNewChatSession("Untitled", true);
          if (!newChatId) return;
        }
        
        // Clear existing messages for this chat if any
        const db = getFirestore(firebaseApp);
        const messagesRef = collection(db, "users", user.userID, "chatSessions", activeChatId, "messages");
        const messagesSnapshot = await getDocs(messagesRef);
        
        // Delete all existing messages
        const deletePromises = messagesSnapshot.docs.map(doc => 
          deleteDoc(doc.ref)
        );
        await Promise.all(deletePromises);
        
        // Add welcome message
        await addDoc(messagesRef, {
          type: "bot",
          text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis.",
          timestamp: serverTimestamp()
        });
      }
      
      return;
    }

    // Create new chat session if there's no active one
    if (user && user.userID && !activeChatId) {
      const newChatId = await createNewChatSession("Untitled", true);
      if (!newChatId) return;
    }

    // Add user's message to UI immediately
    const userMessage = { type: "user", text: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    
    // Save user message to Firestore
    await saveMessageToFirestore(userMessage);
    
    setIsLoading(true);
    setInput("");

    try {
      const response = await axios.post("http://localhost:3002/api/analyze-paper", {
        identifier: input,
      });

      const { data } = response;
      
      // Format the bot response as rich content
      const botMessage = {
        type: "bot",
        text: (
          <div className="bot-response">
            <h3>Paper Information</h3>
            <p>
              <strong>Title:</strong> {data.title}
            </p>
            <p>
              <strong>DOI:</strong> {data.doi || "Not available"}
            </p>
            <p>
              <strong>Publication Date:</strong> {data.publication_date || "Not available"}
            </p>
            <p>
              <strong>Journal:</strong> {data.journal || "Not available"}
            </p>
            <p>
              <strong>Authors:</strong>{" "}
              {data.authors ? data.authors.join(", ") : "Not available"}
            </p>

            {data.retraction_notice && (
              <div className="retraction-notice">
                <p>
                  <strong>⚠️ Retraction Notice:</strong> {data.retraction_notice}
                </p>
              </div>
            )}

            <h3>References</h3>
            {data.references && data.references.length > 0 ? (
              <ul className="references-list">
                {data.references.map((ref, index) => (
                  <ReferenceItem
                    key={index}
                    reference={ref}
                    index={index}
                    userID={user?.userID}
                  />
                ))}
              </ul>
            ) : (
              <p>No references available for this paper.</p>
            )}
          </div>
        ),
      };
      
      // Save the formatted bot response to Firestore
      await saveMessageToFirestore(botMessage);
      
      // Update UI with the bot response
      setMessages([...updatedMessages, botMessage]);
    } catch (error) {
      console.error("Error analyzing paper:", error);
      
      // Create error message
      const errorMessage = {
        type: "bot",
        text: `Error analyzing paper: ${error.response?.data?.error || error.message || "Unknown error"}. Please try again with a different identifier.`
      };
      
      // Save error message to Firestore
      await saveMessageToFirestore(errorMessage);
      
      // Update UI with error message
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle file uploads
  const uploadDocument = async () => {
    if (!uploadedFile) {
      alert("Please select a file to upload first.");
      return;
    }

    // Create new chat session if there's no active one
    if (user && user.userID && !activeChatId) {
      const newChatId = await createNewChatSession("Untitled", true);
      if (!newChatId) return;
    }

    // Add user's message to UI immediately
    const userMessage = {
      type: "user",
      text: `Uploading document: ${uploadedFile.name}`,
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    
    // Save user message to Firestore
    await saveMessageToFirestore(userMessage);

    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", uploadedFile);

    try {
      const response = await axios.post(
        "http://localhost:3002/api/upload-document",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          },
        }
      );

      const { data } = response;
      
      // Format the bot response as rich content
      const botMessage = {
        type: "bot",
        text: (
          <div className="bot-response">
            <h3>Document Analysis</h3>
            <p>
              <strong>Title:</strong> {data.title || "Not detected"}
            </p>
            <p>
              <strong>Extracted DOI:</strong> {data.doi || "Not detected"}
            </p>
            <p>
              <strong>Authors:</strong>{" "}
              {data.authors ? data.authors.join(", ") : "Not detected"}
            </p>

            <h3>References</h3>
            {data.references && data.references.length > 0 ? (
              <ul className="references-list">
                {data.references.map((ref, index) => (
                  <ReferenceItem
                    key={index}
                    reference={ref}
                    index={index}
                    userID={user?.userID}
                  />
                ))}
              </ul>
            ) : (
              <p>No references were detected in this document.</p>
            )}
          </div>
        ),
      };
      
      // Save the formatted bot response to Firestore
      await saveMessageToFirestore(botMessage);
      
      // Update UI with the bot response
      setMessages([...updatedMessages, botMessage]);
      
      // Reset file and progress
      setUploadedFile(null);
      setUploadProgress(0);
    } catch (error) {
      console.error("Error uploading document:", error);
      
      // Create error message
      const errorMessage = {
        type: "bot",
        text: `Error analyzing document: ${error.response?.data?.error || error.message || "Unknown error"}. Please try a different file or format.`
      };
      
      // Save error message to Firestore
      await saveMessageToFirestore(errorMessage);
      
      // Update UI with error message
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleFileButtonClick = () => {
    fileInputRef.current.click();
  };

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // UI for the three-panel layout
  return (
    <>
      <NavigationHeader />

      <Helmet>
        <title>Research Paper Validator - VerifAI</title>
        <meta name="description" content="Validate and cite research papers" />
        <style>
          {/* CSS styles here */}
        </style>
      </Helmet>

      <ChatContext.Provider value={{ activeChatId }}>
        <div className="chat-container">
          {/* Chat History Sidebar */}
          <div
            style={{
              width: "250px",
              borderRight: "1px solid #e0e0e0",
              display: "flex",
              flexDirection: "column",
              background: "#f7f7f7",
            }}
          >
            <div
              style={{
                padding: "15px",
                paddingTop: "20px",
                borderBottom: "1px solid #e0e0e0",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <h3 style={{ margin: 0 }}>Chat History</h3>
              <button
                onClick={() => setShowNewChatInput(!showNewChatInput)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "20px",
                }}
              >
                +
              </button>
            </div>

            {/* New Chat Input */}
            {showNewChatInput && (
              <div style={{ padding: "10px", borderBottom: "1px solid #e0e0e0" }}>
                <input
                  type="text"
                  value={newChatTitle}
                  onChange={(e) => setNewChatTitle(e.target.value)}
                  placeholder="Enter chat title"
                  style={{
                    width: "70%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
                <button
                  onClick={() => createNewChatSession(newChatTitle || "Untitled")}
                  style={{
                    marginLeft: "5px",
                    padding: "8px",
                    background: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Create
                </button>
              </div>
            )}

            {/* Chat Sessions List */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {chatSessions.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  style={{
                    padding: "12px 15px",
                    cursor: "pointer",
                    borderBottom: "1px solid #eee",
                    background: activeChatId === chat.id ? "#e1f5fe" : "transparent",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {chat.title}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChatSession(chat.id);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#999",
                      cursor: "pointer",
                      fontSize: "16px",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {chatSessions.length === 0 && (
                <div style={{ padding: "15px", color: "#666", textAlign: "center" }}>
                  No chat sessions yet
                </div>
              )}
            </div>

            {/* User Controls */}
            <div
              style={{
                padding: "15px",
                borderTop: "1px solid #e0e0e0",
                display: "flex",
                justifyContent: "center",
              }}
            >
              {user && user.userID ? (
                <button
                  onClick={() => {
                    user.logout();
                    navigate("/");
                  }}
                  style={{
                    padding: "8px 15px",
                    background: "#f44336",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Logout
                </button>
              ) : (
                <button
                  onClick={() => navigate("/login")}
                  style={{
                    padding: "8px 15px",
                    background: "#2196F3",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Login
                </button>
              )}
            </div>
          </div>

          {/* Citations Sidebar */}
          <div
            style={{
              width: "300px",
              borderRight: "1px solid #e0e0e0",
              overflowY: "auto",
              background: "#fcfcfc",
            }}
          >
            <div
              style={{
                padding: "15px",
                paddingTop: "20px",
                borderBottom: "1px solid #e0e0e0",
              }}
            >
              <h3 style={{ margin: 0 }}>Saved Citations</h3>
            </div>
            
            <div className="citations-container">
              {citations.length === 0 ? (
                <p className="no-citations">No citations saved yet.</p>
              ) : (
                <ul className="citations-list">
                  {citations.map((citation, index) => (
                    <li key={citation.id} className="citation-item">
                      <h4>{citation.title}</h4>
                      {citation.authors && (
                        <p>Authors: {Array.isArray(citation.authors) ? citation.authors.join(", ") : citation.authors}</p>
                      )}
                      {citation.year && <p>Year: {citation.year}</p>}
                      {citation.doi && (
                        <p>
                          DOI:{" "}
                          <a
                            href={`https://doi.org/${citation.doi}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {citation.doi}
                          </a>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Main Chat Area */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              height: "100%",
            }}
          >
            {/* Chat Messages */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px",
                background: "#fff",
              }}
            >
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`message-container ${message.type === "user" ? "user-message" : "bot-message"}`}
                >
                  <div className="message-avatar">
                    {message.type === "user" ? "👤" : "🤖"}
                  </div>
                  <div className="message-content">
                    {typeof message.text === 'string' ? (
                      message.text
                    ) : (
                      // For JSX elements or objects
                      message.text
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="message-container bot-message">
                  <div className="message-avatar">🤖</div>
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div
              style={{
                borderTop: "1px solid #e0e0e0",
                padding: "15px",
                background: "#f7f7f7",
              }}
            >
              <form onSubmit={searchPaper} style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  placeholder="Enter paper title, DOI, or ISBN..."
                  style={{
                    flex: 1,
                    padding: "12px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "16px",
                  }}
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    padding: "12px 20px",
                    background: "#2196F3",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "16px",
                  }}
                >
                  Search
                </button>
              </form>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "10px",
                }}
              >
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                    accept=".pdf,.doc,.docx"
                  />
                  <button
                    onClick={handleFileButtonClick}
                    style={{
                      padding: "8px 15px",
                      background: "#4CAF50",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Choose File
                  </button>
                  <span style={{ marginLeft: "10px" }}>
                    {uploadedFile ? uploadedFile.name : "No file chosen"}
                  </span>
                </div>
                <button
                  onClick={uploadDocument}
                  disabled={!uploadedFile || isLoading}
                  style={{
                    padding: "8px 15px",
                    background: uploadedFile ? "#4CAF50" : "#ccc",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: uploadedFile ? "pointer" : "not-allowed",
                  }}
                >
                  Upload & Analyze
                </button>
              </div>

              {uploadProgress > 0 && uploadProgress < 100 && (
                <div style={{ marginTop: "10px" }}>
                  <div
                    style={{
                      height: "8px",
                      width: "100%",
                      backgroundColor: "#e0e0e0",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${uploadProgress}%`,
                        backgroundColor: "#4CAF50",
                      }}
                    ></div>
                  </div>
                  <div style={{ textAlign: "center", marginTop: "5px" }}>
                    {uploadProgress}%
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ChatContext.Provider>
    </>
  );
};

export default Chat;
