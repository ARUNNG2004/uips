import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import Modal from '../../components/UI/Modal';

const parseExamEndTimestamp = (value) => {
  if (!value) return null;

  const asString = String(value).trim();
  const timeOnlyMatch = asString.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (timeOnlyMatch) {
    const hours = Number(timeOnlyMatch[1]);
    const minutes = Number(timeOnlyMatch[2]);
    const seconds = Number(timeOnlyMatch[3] || '0');

    const endDate = new Date();
    endDate.setHours(hours, minutes, seconds, 0);
    return endDate.getTime();
  }

  const parsed = new Date(asString);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
};

const ExamSession = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket(user?.id);

  const [timeRemaining, setTimeRemaining] = useState('00:00:00');
  const [uptime, setUptime] = useState(0);
  const [status, setStatus] = useState({ cam: false, mic: false, conn: true });
  const [showError, setShowError] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showForceEndModal, setShowForceEndModal] = useState(false);
  const [exam, setExam] = useState(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [threatLevel, setThreatLevel] = useState('LOW');
  const [alreadyTaken, setAlreadyTaken] = useState(false);
  const [mlAnalysis, setMlAnalysis] = useState({
    audio_risk: 0,
    visual_risk: 0,
    behavior_risk: 0,
    integrity_score: 100,
    face_detected: false,
    face_count: 0,
    anomalies: []
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalsRef = useRef([]);
  const prevFrameRef = useRef(null);
  const tabSwitchRef = useRef(0);

  const sessionId = sessionStorage.getItem('uips_session_id');
  const examId = sessionStorage.getItem('uips_exam_id');

  useEffect(() => {
    if (!sessionId || !examId) {
      navigate('/student/waiting-room');
      return;
    }

    client.get(`/api/exams/${examId}`).then(res => setExam(res.data)).catch(console.error);

    client.get('/api/session/my')
      .then(res => {
        const existingSession = res.data.find(s => s.id === parseInt(sessionId));
        if (existingSession && existingSession.status === 'completed') {
          setAlreadyTaken(true);
        }
      })
      .catch(console.error);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchRef.current += 1;
        setTabSwitchCount(tabSwitchRef.current);

        if (tabSwitchRef.current >= 5 && !autoSubmitted) {
          setAutoSubmitted(true);
          setShowEndModal(true);
          setTimeout(() => {
            autoSubmitExam();
          }, 2000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true })
      .then(stream => {
         streamRef.current = stream;
         if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
         }
         setStatus(s => ({ ...s, cam: true, mic: true }));
         startTelemetry(stream);
      })
      .catch(err => {
         console.error("CRITICAL DEVICE FAILURE", err);
         setShowError(true);
      });

    return () => {
       document.removeEventListener('visibilitychange', handleVisibilityChange);
       intervalsRef.current.forEach(id => typeof id === 'function' ? id() : clearInterval(id));
       intervalsRef.current = [];
       if (streamRef.current) {
         streamRef.current.getTracks().forEach(t => {
           t.enabled = false;
           t.stop();
         });
       }
    };
  }, [sessionId, examId]);

  // ── Listen for invigilator force-end via WebSocket + polling fallback ──
  useEffect(() => {
    if (!sessionId) return;

    const handleForceEnd = (data) => {
      if (String(data.session_id) === String(sessionId) && data.status === 'completed') {
        forceEndCleanup();
      }
    };

    if (socket) {
      socket.on('session_status_update', handleForceEnd);
    }

    // Polling fallback: check session status every 10s
    const pollInterval = setInterval(() => {
      client.get('/api/session/my')
        .then(res => {
          const sess = res.data.find(s => s.id === parseInt(sessionId));
          if (sess && sess.status === 'completed') {
            forceEndCleanup();
          }
        })
        .catch(() => {});
    }, 10000);

    return () => {
      if (socket) socket.off('session_status_update', handleForceEnd);
      clearInterval(pollInterval);
    };
  }, [socket, sessionId]);

  const forceEndCleanup = () => {
    // Stop camera/mic
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.enabled = false;
        track.stop();
      });
    }
    // Clear intervals
    intervalsRef.current.forEach(id => typeof id === 'function' ? id() : clearInterval(id));
    intervalsRef.current = [];

    // Show force-end modal then redirect
    setShowForceEndModal(true);
    setTimeout(() => {
      sessionStorage.setItem('uips_completion_session_id', sessionId);
      sessionStorage.removeItem('uips_session_id');
      sessionStorage.removeItem('uips_exam_id');
      navigate('/student/exam-completed');
    }, 3000);
  };

  useEffect(() => {
    const tInterval = setInterval(() => {
       setUptime(up => up + 1);
       if (exam?.end_time) {
          const endTimestamp = parseExamEndTimestamp(exam.end_time);
          if (!endTimestamp) {
            setTimeRemaining("ACTIVE");
            return;
          }

          const remain = Math.max(0, endTimestamp - Date.now());
          const h = Math.floor(remain / 3600000).toString().padStart(2, '0');
          const m = Math.floor((remain % 3600000) / 60000).toString().padStart(2, '0');
          const s = Math.floor((remain % 60000) / 1000).toString().padStart(2, '0');
          setTimeRemaining(`${h}:${m}:${s}`);
       } else {
          setTimeRemaining("ACTIVE");
       }
    }, 1000);

    return () => clearInterval(tInterval);
  }, [exam?.end_time]);

  // ML Inference Analysis - near real-time polling
  useEffect(() => {
    if (!sessionId) return;

    const fetchMlAnalysis = async () => {
      try {
        const response = await client.post('/api/session/ml-analysis', {
          session_id: sessionId
        });

        if (response.data) {
          setMlAnalysis({
            audio_risk: response.data.audio_risk || 0,
            visual_risk: response.data.visual_risk || 0,
            behavior_risk: response.data.behavior_risk || 0,
            integrity_score: response.data.integrity_score || 100,
            face_detected: response.data.face_detected || false,
            face_count: response.data.face_count || 0,
            anomalies: response.data.anomalies || []
          });

          // FIXED LOGIC: Show LOW when any face detected (including multiple)
          if (!response.data.face_detected || response.data.face_count === 0) {
            setThreatLevel('HIGH');
          } else if (response.data.face_count > 1) {
            // Multiple faces detected = LOW threat
            setThreatLevel('LOW');
          } else if (response.data.behavior_risk >= 50 || response.data.visual_risk >= 50) {
            // 1 Face is detected but behavior is risky -> keep it MEDIUM, do not go HIGH
            setThreatLevel('MEDIUM');
          } else {
            // 1 Face detected, all clear -> LOW
            setThreatLevel('LOW');
          }
        }
      } catch (e) {
        console.log("ML analysis unavailable, using default values");
      }
    };

    fetchMlAnalysis();
    const mlInterval = setInterval(fetchMlAnalysis, 3000);

    return () => clearInterval(mlInterval);
  }, [sessionId]);

  const startTelemetry = (stream) => {
     const vidInt = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);

        try {
          const imgData = ctx.getImageData(0, 0, 640, 480);
          const data = imgData.data;

          let blackPixels = 0;
          let totalPixels = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            totalPixels++;
            if (r < 10 && g < 10 && b < 10) {
              blackPixels++;
            }
          }

          const blackPercentage = (blackPixels / totalPixels) * 100;

          let motionSum = 0;
          if (prevFrameRef.current) {
            for (let i = 0; i < data.length; i += 4) {
              const diff = Math.abs(data[i] - prevFrameRef.current[i]) +
                          Math.abs(data[i+1] - prevFrameRef.current[i+1]) +
                          Math.abs(data[i+2] - prevFrameRef.current[i+2]);
              motionSum += diff;
            }
          }

          const motionIntensity = motionSum / (640 * 480 * 100);

          // FIXED LOGIC: Motion should not trigger HIGH unless it's a completely black camera.
          if (blackPercentage > 80) {
            setThreatLevel('HIGH');
          } else if (motionIntensity > 15 || motionIntensity > 5) {
            // High/Medium motion just sets it to MEDIUM so it doesn't falsely overwrite face detection
            setThreatLevel(prev => prev === 'HIGH' ? 'HIGH' : 'MEDIUM');
          } else {
            setThreatLevel(prev => prev === 'HIGH' ? 'HIGH' : 'LOW');
          }

          prevFrameRef.current = new Uint8ClampedArray(data);
        } catch (e) {
          console.log("Motion detection unavailable");
        }

        canvasRef.current.toBlob((blob) => {
           if (!blob) return;
           const fd = new FormData();
           fd.append('session_id', sessionId);
           fd.append('frame', blob, `frame_${Date.now()}.jpg`);
           client.post('/api/session/stream/video', fd, { headers: { 'Content-Type': 'multipart/form-data' }})
             .catch(() => setStatus(s => ({ ...s, conn: false })))
             .then(() => setStatus(s => ({ ...s, conn: true })));
        }, 'image/jpeg', 0.7);
     }, 5000);
     intervalsRef.current.push(vidInt);

     try {
       const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
       mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
              const fd = new FormData();
              fd.append('session_id', sessionId);
              fd.append('chunk', e.data, `audio_${Date.now()}.webm`);
              client.post('/api/session/stream/audio', fd, { headers: { 'Content-Type': 'multipart/form-data' }});
          }
       };

       const audInt = setInterval(() => {
          if (mediaRecorder.state === "recording") {
             mediaRecorder.stop();
          }
          mediaRecorder.start();
       }, 10000);
       intervalsRef.current.push(audInt);
       mediaRecorder.start();
     } catch (e) {
       console.error("Audio Muxing missing", e);
     }

     let timeoutId;
     const trackBehavior = (type) => {
         clearTimeout(timeoutId);
         timeoutId = setTimeout(() => {
             client.post('/api/session/stream/behavior', {
               session_id: sessionId,
               event_type: type,
               timestamp: new Date().toISOString()
             }).catch(()=>{});
         }, 1000);
     };

     const mouseH = () => trackBehavior("mousemove");
     const keyH = () => trackBehavior("keydown");

     document.addEventListener('mousemove', mouseH);
     document.addEventListener('keydown', keyH);

     intervalsRef.current.push(() => {
         document.removeEventListener('mousemove', mouseH);
         document.removeEventListener('keydown', keyH);
         clearTimeout(timeoutId);
     });
  };

  const finalizeSession = async () => {
     try {
       if (streamRef.current) {
         streamRef.current.getTracks().forEach(track => {
           track.enabled = false;
           track.stop();
         });
       }

       await client.post('/api/session/end', { session_id: sessionId });
       sessionStorage.setItem('uips_completion_session_id', sessionId);
       sessionStorage.removeItem('uips_session_id');
       sessionStorage.removeItem('uips_exam_id');
       navigate('/student/exam-completed');
     } catch(e) {
       alert("Network error. Unable to end session properly.");
     }
  };

  const autoSubmitExam = async () => {
     try {
       if (streamRef.current) {
         streamRef.current.getTracks().forEach(track => {
           track.enabled = false;
           track.stop();
         });
       }

       await client.post('/api/session/end', { session_id: sessionId });
       sessionStorage.setItem('uips_completion_session_id', sessionId);
       sessionStorage.removeItem('uips_session_id');
       sessionStorage.removeItem('uips_exam_id');
       navigate('/student/exam-completed');
     } catch(e) {
       alert("Network error. Unable to end session properly.");
     }
  };

  const handleAnswerSelect = (questionId, selectedOption) => {
     setSelectedAnswers(prev => ({
       ...prev,
       [questionId]: selectedOption
     }));
  };

  const handleSubmitAnswers = async () => {
     const unansweredCount = questions.length - Object.keys(selectedAnswers).length;
     if (unansweredCount > 0) {
       alert(`Please answer all ${unansweredCount} remaining question(s) before submitting.`);
       return;
     }

     setSubmitting(true);
     try {
       let score = 0;
       questions.forEach(q => {
         if (selectedAnswers[q.id] === q.correctAnswer) {
           score++;
         }
       });

       const percentage = Math.round((score / questions.length) * 100);

       const getRiskLevel = (value) => {
         if (value < 50) return 'LOW';
         if (value < 85) return 'MEDIUM';
         return 'HIGH';
       };

       const audioRiskLevel = getRiskLevel(mlAnalysis.audio_risk);
       const visualRiskLevel = getRiskLevel(mlAnalysis.visual_risk);
       const behaviorRiskLevel = getRiskLevel(mlAnalysis.behavior_risk);

       try {
         await client.post('/api/session/submit-exam-analysis', {
           session_id: sessionId,
           answers: selectedAnswers,
           score: score,
           total_questions: questions.length,
           percentage: percentage,
           ml_analysis: {
             audio_risk: mlAnalysis.audio_risk,
             visual_risk: mlAnalysis.visual_risk,
             behavior_risk: mlAnalysis.behavior_risk,
             audio_risk_level: audioRiskLevel,
             visual_risk_level: visualRiskLevel,
             behavior_risk_level: behaviorRiskLevel,
             integrity_score: mlAnalysis.integrity_score
           }
         });
       } catch(e) {
         console.log("Note: Could not log analysis to server, proceeding anyway");
       }

       if (streamRef.current) {
         streamRef.current.getTracks().forEach(track => {
           track.enabled = false;
           track.stop();
         });
       }

       intervalsRef.current.forEach(id => typeof id === 'function' ? id() : clearInterval(id));
       intervalsRef.current = [];

       await client.post('/api/session/end', { session_id: sessionId });

       sessionStorage.setItem('uips_completion_session_id', sessionId);
       sessionStorage.removeItem('uips_session_id');
       sessionStorage.removeItem('uips_exam_id');

       navigate('/student/exam-completed');
     } catch(e) {
       console.error("Error submitting exam:", e);
       alert("Error submitting exam. Please try again.");
     } finally {
       setSubmitting(false);
     }
  };

 const questions = [
    {
      id: 1,
      question: "Which React hook is used to manage state within a functional component?",
      correctAnswer: "useState",
      options: ["useEffect", "useState", "useContext", "useReducer"]
    },
    {
      id: 2,
      question: "In Redux, what is responsible for specifying how the application's state changes in response to an action?",
      correctAnswer: "Reducer",
      options: ["Store", "Action", "Component", "Reducer"]
    },
    {
      id: 3,
      question: "Which command is used to build a Docker image from a Dockerfile?",
      correctAnswer: "docker build",
      options: ["docker run", "docker create", "docker build", "docker compile"]
    },
    {
      id: 4,
      question: "Which of the following is NOT a primitive data type in Java?",
      correctAnswer: "String",
      options: ["int", "boolean", "String", "double"]
    },
    {
      id: 5,
      question: "What does JSON stand for?",
      correctAnswer: "JavaScript Object Notation",
      options: [
        "JavaScript Object Notation",
        "Java Standard Output Network",
        "JavaScript Oriented Notation",
        "Java Source Open Network"
      ]
    }
  ];
  return (
    <div className="h-full bg-[#0a0e1a] text-white overflow-y-auto p-6 -m-4 md:-m-8 flex flex-col">
      {alreadyTaken && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-6">
          <div className="bg-[#151d35] border border-[#1e2d4a] rounded-lg p-8 max-w-md text-center shadow-[0_0_20px_rgba(59,130,246,0.15)]">
            <div className="mb-6">
              <div className="w-16 h-16 bg-[#10b981]/20 rounded-full flex items-center justify-center mx-auto">
                <span className="text-4xl">✓</span>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 font-mono tracking-widest">EXAM COMPLETED</h2>
            <p className="text-[#64748b] mb-6">This exam has already been taken. You cannot retake it at this time.</p>
            <button
              onClick={() => navigate('/student/waiting-room')}
              className="w-full py-3 px-4 bg-[#3b82f6] hover:bg-blue-600 text-white font-mono tracking-wider rounded-md transition-colors"
            >
              RETURN TO WAITING ROOM
            </button>
          </div>
        </div>
      )}

      {!alreadyTaken && (
      <>
      {tabSwitchCount > 0 && tabSwitchCount < 5 && (
        <div className="mb-4 p-4 bg-[#ef4444]/20 border border-[#ef4444] rounded-lg">
          <p className="text-sm text-[#fca5a5] font-mono">⚠️ WARNING: Tab switches detected: {tabSwitchCount}/5. The exam will auto-submit if you switch tabs {5 - tabSwitchCount} more time(s).</p>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">

        <div className="md:w-[62%] flex flex-col space-y-4 overflow-y-auto">

           <div className="flex justify-between items-center bg-[#151d35] border border-[#1e2d4a] rounded-lg p-4">
              <div className="flex items-center space-x-3">
                 <div className="w-3 h-3 bg-[#3b82f6] rounded-full" />
                 <span className="font-mono text-sm tracking-widest text-[#3b82f6]">EXAM QUESTIONS</span>
              </div>
              <div className="text-xl font-mono text-[#f59e0b] font-bold">
                 {questions.length} Questions
              </div>
           </div>

           <div className="space-y-4">
             {questions.map((q, idx) => (
               <div key={q.id} className="bg-[#151d35] border border-[#1e2d4a] rounded-lg p-6 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                 <div className="flex items-start justify-between mb-3">
                   <h3 className="text-lg font-bold text-[#3b82f6] font-mono">QUESTION {q.id}</h3>
                   <span className="text-xs bg-[#1e2d4a] text-[#64748b] px-3 py-1 rounded font-mono">Q{q.id}/5</span>
                 </div>

                 <p className="text-white text-base mb-6 leading-relaxed">{q.question}</p>

                 <div className="space-y-3">
                   <p className="text-sm text-[#64748b] font-mono tracking-wider uppercase mb-3">Select Your Answer</p>
                   {q.options.map((option, optIdx) => (
                     <label key={optIdx} className="flex items-center p-3 bg-[#0f1629] border border-[#1e2d4a] rounded cursor-pointer hover:border-[#3b82f6] transition-colors group">
                       <input
                         type="radio"
                         name={`question-${q.id}`}
                         value={option}
                         checked={selectedAnswers[q.id] === option}
                         onChange={() => handleAnswerSelect(q.id, option)}
                         className="w-4 h-4 accent-[#3b82f6] cursor-pointer"
                       />
                       <span className="ml-3 text-white group-hover:text-[#3b82f6] transition-colors">{option}</span>
                       {selectedAnswers[q.id] === option && (
                         <span className="ml-auto text-[#3b82f6]">✓</span>
                       )}
                     </label>
                   ))}
                 </div>
               </div>
             ))}
           </div>

           <div className="mt-6 bg-[#0f1629] border border-[#1e2d4a] rounded-lg p-6 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
             <div className="mb-4">
               <div className="flex justify-between items-center mb-2">
                 <span className="text-sm text-[#64748b] font-mono tracking-wider uppercase">Progress</span>
                 <span className="text-sm font-bold text-[#3b82f6]">{Object.keys(selectedAnswers).length}/{questions.length} Answered</span>
               </div>
               <div className="w-full bg-[#151d35] rounded-full h-2 overflow-hidden">
                 <div
                   className="bg-[#3b82f6] h-full transition-all duration-300"
                   style={{ width: `${(Object.keys(selectedAnswers).length / questions.length) * 100}%` }}
                 />
               </div>
             </div>

             {Object.keys(selectedAnswers).length < questions.length && (
               <p className="text-xs text-[#fca5a5] mt-3 text-center font-mono">
                 Answer all {questions.length - Object.keys(selectedAnswers).length} remaining question(s) to submit
               </p>
             )}
           </div>

        </div>

        <div className="md:w-[38%] flex flex-col space-y-6">

           <div className="bg-black relative rounded-lg border border-[#1e2d4a] shadow-[0_0_20px_rgba(59,130,246,0.15)] overflow-hidden aspect-video md:min-h-[320px] lg:min-h-[360px]">
               <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
               <canvas ref={canvasRef} width="640px" height="600" className="hidden" />

               <div className={`absolute top-4 right-4 px-4 py-2 rounded-lg font-mono text-xs font-bold tracking-widest flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,0,0,0.5)] border-2 ${
                 threatLevel === 'HIGH'
                   ? 'bg-[#ef4444] text-white border-[#dc2626]'
                   : threatLevel === 'MEDIUM'
                   ? 'bg-[#f59e0b] text-[#0a0e1a] border-[#d97706]'
                   : 'bg-[#10b981] text-white border-[#059669]'
               }`}>
                 <div className={`w-2 h-2 rounded-full ${
                   threatLevel === 'HIGH' ? 'animate-pulse' : ''
                 }`} style={{
                   backgroundColor: threatLevel === 'HIGH' ? '#fff' : threatLevel === 'MEDIUM' ? '#000' : '#fff'
                 }} />
                 <span>{threatLevel}</span>
               </div>

               <div className="absolute bottom-4 right-4 w-16 h-16 border-2 border-[#3b82f6] rounded-lg flex items-center justify-center bg-black/50">
                 <div className="text-center">
                   <div className="text-[#3b82f6] text-xs font-mono mb-1">ANGLE</div>
                   <div className={`text-lg font-bold ${
                     threatLevel === 'HIGH' ? 'text-[#ef4444]' : threatLevel === 'MEDIUM' ? 'text-[#f59e0b]' : 'text-[#10b981]'
                   }`}>
                     {threatLevel === 'HIGH' ? '⚠️' : threatLevel === 'MEDIUM' ? '⚡' : '✓'}
                   </div>
                 </div>
               </div>
           </div>

           <div className="bg-[#151d35] border border-[#1e2d4a] p-4 rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.15)]">
              <p className="font-mono text-xs text-[#64748b] tracking-widest uppercase mb-4">INTEGRITY ANALYSIS</p>

              <div className="mb-3 p-3 bg-[#0f1629] rounded border border-[#1e2d4a]">
                 <div className="flex justify-between items-center">
                   <span className="text-xs font-mono text-[#64748b] tracking-wider">FACE</span>
                   <span className={`text-xs font-bold ${mlAnalysis.face_detected ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                     {mlAnalysis.face_detected ? `DETECTED (${mlAnalysis.face_count})` : 'NOT DETECTED'}
                   </span>
                 </div>
              </div>

              <div className="space-y-2 text-xs">
                 <div className="flex justify-between items-center py-2 border-t border-[#1e2d4a]">
                   <span className="text-[#64748b]">Overall</span>
                   <span className={mlAnalysis.integrity_score >= 85 ? 'text-[#10b981]' : mlAnalysis.integrity_score >= 50 ? 'text-[#f59e0b]' : 'text-[#ef4444]'}>
                     {mlAnalysis.integrity_score}%
                   </span>
                 </div>
                 <div className="flex justify-between items-center py-2 border-t border-[#1e2d4a]">
                   <span className="text-[#64748b]">Visual Risk</span>
                   <span className={mlAnalysis.visual_risk < 50 ? 'text-[#10b981]' : mlAnalysis.visual_risk < 85 ? 'text-[#f59e0b]' : 'text-[#ef4444]'}>
                     {mlAnalysis.visual_risk.toFixed(0)}%
                   </span>
                 </div>
                 <div className="flex justify-between items-center py-2 border-t border-[#1e2d4a]">
                   <span className="text-[#64748b]">Behavior Risk</span>
                   <span className={mlAnalysis.behavior_risk < 50 ? 'text-[#10b981]' : mlAnalysis.behavior_risk < 85 ? 'text-[#f59e0b]' : 'text-[#ef4444]'}>
                     {mlAnalysis.behavior_risk.toFixed(0)}%
                   </span>
                 </div>
              </div>
           </div>

        </div>
      </div>

      <div className="mt-6 bg-[#0f1629] border border-[#1e2d4a] p-6 rounded-lg shadow-[0_0_20px_rgba(239,68,68,0.12)]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-mono text-sm tracking-widest text-[#ef4444] uppercase">End Section</p>
            <p className="text-sm text-[#94a3b8]">When you finish answering all questions, end the session from here.</p>
          </div>
          <button
            onClick={() => setShowEndModal(true)}
            className="w-full md:w-auto px-8 py-3 bg-[#ef4444] hover:bg-red-600 text-white font-mono font-bold tracking-widest uppercase transition-colors rounded-md border border-[#ef4444]"
          >
            END EXAM
          </button>
        </div>
      </div>
      </>
      )}

      <Modal isOpen={showError} onClose={() => navigate('/student/waiting-room')} title="HARDWARE LOCKOUT">
         <p className="text-[#f1f5f9] mb-6">Execution failed. Core WebRTC hardware locks (Camera / Microphone) are mandatory to instantiate this assessment block. Ensure permissions are resolved and hardware is unmuted.</p>
         <button onClick={() => navigate('/student/waiting-room')} className="w-full py-3 bg-[#3b82f6] text-white rounded font-mono uppercase">Acknowledged</button>
      </Modal>

      <Modal isOpen={showEndModal} onClose={() => setShowEndModal(false)} title={autoSubmitted ? "EXAM AUTO-SUBMITTED" : "FINALIZE SESSION?"}>
         <p className="text-[#f1f5f9] mb-6">
           {autoSubmitted
             ? `Your exam has been auto-submitted due to ${tabSwitchRef.current} tab switch(es) detected. You have left the exam window too many times. Redirecting to waiting room...`
             : "You are actively terminating your testing module. This action encrypts all telemetries and cannot be reversed. Are you positive?"
           }
         </p>
         <div className="flex space-x-4">
             {!autoSubmitted && (
               <>
                 <button onClick={() => setShowEndModal(false)} className="flex-1 py-3 bg-[#0f1629] border border-[#1e2d4a] text-white rounded font-mono uppercase hover:bg-white/5 transition-colors">CANCEL</button>
                 <button onClick={finalizeSession} className="flex-1 py-3 bg-[#ef4444] text-white rounded font-mono uppercase shadow-[0_0_20px_rgba(239,68,68,0.15)] hover:bg-red-600 transition-colors">CONFIRM FINISH</button>
               </>
             )}
         </div>
      </Modal>

       <Modal isOpen={showForceEndModal} title="EXAM TERMINATED BY INVIGILATOR">
          <p className="text-[#f1f5f9] mb-4">Your exam session has been ended by the invigilator. All your responses have been recorded.</p>
          <p className="text-[#64748b] text-sm font-mono">Redirecting to results page...</p>
          <div className="mt-4 w-full bg-[#1e2d4a] rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#ef4444] h-full rounded-full animate-pulse" style={{ width: '100%' }} />
          </div>
       </Modal>
    </div>
  );
};

export default ExamSession;
