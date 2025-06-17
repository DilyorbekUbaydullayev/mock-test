
import { useState, useEffect } from "react";
import * as mammoth from "mammoth";

function App() {
  const [testFile, setTestFile] = useState(null);
  const [answerFile, setAnswerFile] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [testStarted, setTestStarted] = useState(false);
  const [testFinished, setTestFinished] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectAnswers, setIncorrectAnswers] = useState([]);

  // Load files from localStorage on component mount
  useEffect(() => {
    const savedTestFile = localStorage.getItem('testFile');
    const savedAnswerFile = localStorage.getItem('answerFile');
    
    if (savedTestFile) {
      const file = new File([savedTestFile], localStorage.getItem('testFileName') || 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      setTestFile(file);
    }
    
    if (savedAnswerFile) {
      const file = new File([savedAnswerFile], localStorage.getItem('answerFileName') || 'answers.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      setAnswerFile(file);
    }
  }, []);

  const resetStates = () => {
    setUserAnswers({});
    setTestStarted(false);
    setTestFinished(false);
    setCorrectCount(0);
    setIncorrectAnswers([]);
    setSelectedQuestions([]);
  };

  const parseDocxFile = async (file) => {
    try {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = async (event) => {
          const arrayBuffer = event.target.result;
          try {
            const result = await mammoth.extractRawText({ arrayBuffer });
            resolve(result.value);
          } catch (error) {
            reject("Mammoth xatosi: " + error.message);
          }
        };
        reader.onerror = () => reject("Faylni o'qib bo'lmadi.");
        reader.readAsArrayBuffer(file);
      });
    } catch (error) {
      console.error("Faylni o'qishda xatolik:", error);
      return "";
    }
  };

  const saveFileToLocalStorage = async (file, fileType) => {
    const reader = new FileReader();
    reader.onload = () => {
      localStorage.setItem(fileType, reader.result);
      localStorage.setItem(`${fileType}Name`, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleTestFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setTestFile(file);
      saveFileToLocalStorage(file, 'testFile');
    }
  };

  const handleAnswerFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAnswerFile(file);
      saveFileToLocalStorage(file, 'answerFile');
    }
  };

  const handleStartTest = async () => {
    if (!testFile || !answerFile) {
      alert("Iltimos, savollar va javoblar faylini yuklang!");
      return;
    }

    // Reset all states before starting new test
    resetStates();

    try {
      const testContent = await parseDocxFile(testFile);
      const answerContent = await parseDocxFile(answerFile);

      const rawLines = testContent.split(/\n/g).map((line) => line.trim());
      let parsedQuestions = [];
      let currentQuestion = { question: "", variants: [] };

      rawLines.forEach((line) => {
        if (/^\d+\./.test(line)) {
          if (currentQuestion.question !== "" && currentQuestion.variants.length > 0) {
            parsedQuestions.push(currentQuestion);
          }
          currentQuestion = { question: line, variants: [] };
        } else if (/^[A-D]\)/.test(line)) {
          currentQuestion.variants.push(line);
        }
      });

      if (currentQuestion.question !== "" && currentQuestion.variants.length > 0) {
        parsedQuestions.push(currentQuestion);
      }

      if (parsedQuestions.length === 0) {
        alert("Savollar yuklanmadi! Iltimos, fayl formatini tekshiring.");
        return;
      }

      const parsedAnswers = answerContent
        .split(/\n/g)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((ansLine) => {
          let parts = ansLine.split(".");
          return { questionNum: parts[0].trim(), correct: parts[1].trim() };
        });

      let shuffled = [...parsedQuestions].sort(() => 0.5 - Math.random());
      let fiftyQuestions = shuffled.slice(0, 50);

      setQuestions(parsedQuestions);
      setAnswers(parsedAnswers);
      setSelectedQuestions(fiftyQuestions);
      setTestStarted(true);
    } catch (error) {
      console.error("Testni yuklashda xatolik:", error);
      alert("Testni yuklashda xatolik yuz berdi! Qayta yuklab koring");
    }
  };

  const handleOptionChange = (questionIndex, chosenVariant) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionIndex]: chosenVariant,
    }));
  };

  const getFullAnswerText = (question, answerKey) => {
    const correctVariant = question.variants.find(variant => 
      variant.startsWith(answerKey + ")")
    );
    return correctVariant ? correctVariant.substring(correctVariant.indexOf(")") + 1).trim() : answerKey;
  };

  const handleFinishTest = () => {
    let correctCount = 0;
    let incorrectAnswers = [];

    selectedQuestions.forEach((q, index) => {
      let match = q.question.match(/^(\d+)\./);
      let qNum = match ? match[1] : null;

      if (qNum) {
        let ansObj = answers.find((ans) => ans.questionNum === qNum);
        if (ansObj) {
          let userAns = userAnswers[index];
          if (userAns && userAns.includes(ansObj.correct)) {
            correctCount++;
          } else {
            incorrectAnswers.push({
              question: q.question,
              correctAnswer: getFullAnswerText(q, ansObj.correct),
              userAnswer: userAns ? userAns : "Javob berilmagan"
            });
          }
        }
      }
    });

    setCorrectCount(correctCount);
    setIncorrectAnswers(incorrectAnswers);
    setTestFinished(true);
  };

  const getScoreColorClass = (score) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-8">
        Test sistemasi
      </h1>

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Test fayllarini yuklash
            </h2>
            <div className="space-y-4">
              <div>
                <input
                  accept=".docx"
                  className="hidden"
                  id="test-file-upload"
                  type="file"
                  onChange={handleTestFileUpload}
                />
                <label 
                  htmlFor="test-file-upload"
                  className="block w-full px-4 py-2 text-center border-2 border-blue-500 rounded-lg hover:bg-blue-50 cursor-pointer"
                >
                  Test savollari (.docx)
                </label>
                {testFile && (
                  <p className="mt-2 text-sm text-green-600">
                    ✓ {testFile.name}
                  </p>
                )}
              </div>

              <div>
                <input
                  accept=".docx"
                  className="hidden"
                  id="answer-file-upload"
                  type="file"
                  onChange={handleAnswerFileUpload}
                />
                <label 
                  htmlFor="answer-file-upload"
                  className="block w-full px-4 py-2 text-center border-2 border-blue-500 rounded-lg hover:bg-blue-50 cursor-pointer"
                >
                  Javoblar fayli (.docx)
                </label>
                {answerFile && (
                  <p className="mt-2 text-sm text-green-600">
                    ✓ {answerFile.name}
                  </p>
                )}

              </div>
              <div>
                <a href="/Hisob2 test.pdf">
                <label 
                  
                  className="block w-full px-4 py-2 text-center border-2 border-blue-500 rounded-lg hover:bg-blue-50 cursor-pointer"
                >
                  hisob javoblar
                </label>
                </a>
              </div>
            </div>
          </div>

          <button
            onClick={testStarted ? resetStates : handleStartTest}
            disabled={!testFile || !answerFile}
            className={`w-full py-2 px-4 rounded-lg text-white font-medium
              ${(!testFile || !answerFile) 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {testStarted ? "Qayta boshlash" : "Testni boshlash"}
          </button>
        </div>
      </div>

      {testStarted && !testFinished && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <h2 className="text-xl font-semibold mb-4">
            Testni yeching
          </h2>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${Object.keys(userAnswers).length * 2}%` }}
            ></div>
          </div>
          <div className="space-y-6">
            {selectedQuestions.map((q, index) => (
              <div key={index} className="border-2 rounded-lg p-4 border-blue-500">
                <h3 className="text-base font-semibold mb-3">
                  {index + 1}{') '} {q.question}
                </h3>
                <div className="space-y-2">
                  {q.variants.map((opt, i) => (
                    <label key={i} className="flex items-start space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`question-${index}`}
                        value={opt}
                        checked={userAnswers[index] === opt}
                        onChange={() => handleOptionChange(index, opt)}
                        className="mt-1"
                      />
                      <span className="text-sm xs:mt-1">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <button
              onClick={handleFinishTest}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg"
            >
              Testni yakunlash
            </button>
          </div>
        </div>
      )}

      {testFinished && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4 ">
          <h2 className="text-xl font-semibold mb-4">
            Test natijalari
          </h2>
          <div className="text-center mb-6">
            <p className={`text-4xl font-bold mb-2 ${getScoreColorClass((correctCount / 50) * 100)}`}>
              {correctCount} / 50
            </p>
            <p className={`text-xl ${getScoreColorClass((correctCount / 50) * 100)}`}>
              {((correctCount / 50) * 100).toFixed(2)}%
            </p>
          </div>
          
          <hr className="my-6" />

          <h3 className="text-lg font-semibold mb-4">
            Xato javoblar
          </h3>
          <div className="space-y-4">
            {incorrectAnswers.map((item, i) => (
              <div key={i} className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="font-medium mb-2">{item.question}</p>
                <p className="text-sm text-gray-600">
                  To&apos;g&apos;ri javob: <span className="font-semibold">{item.correctAnswer}</span>
                </p>
                <p className="text-sm text-red-600 mt-2">
                  Sizning javobingiz: {item.userAnswer}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={resetStates}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg"
            >
              Qayta boshlash
            </button>
          </div>
        </div>
      )}
      

    </div>
    
  );
}

export default App;