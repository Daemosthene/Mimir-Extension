// Main application code for AI Text Humanizer

// Initialize compromise plugins - Wrap in a check to avoid errors
if (typeof window.nlp !== 'undefined') {
    // Only extend if compromise is properly loaded
    window.nlp.extend(window.compromiseSentences);
}

// Class equivalent to AcademicTextHumanizer
class AcademicTextHumanizer {
    constructor(options = {}) {
        this.p_passive = options.p_passive || 0.2;
        this.p_synonym_replacement = options.p_synonym_replacement || 0.3;
        this.p_academic_transition = options.p_academic_transition || 0.3;
        
        // Common academic transitions
        this.academic_transitions = [
            "Moreover,", "Additionally,", "Furthermore,", "Hence,", 
            "Therefore,", "Consequently,", "Nonetheless,", "Nevertheless,",
            "In light of this,", "Given these points,", "Subsequently,",
            "In this regard,", "To this end,", "In this context,",
            "Correspondingly,", "Similarly,", "Equally important,"
        ];
        
        // English contractions map (expanded)
        this.contraction_map = {
            "n't": " not", 
            "'re": " are", 
            "'s": " is", 
            "'ll": " will",
            "'ve": " have", 
            "'d": " would", 
            "'m": " am",
            "ain't": "am not",
            "aren't": "are not",
            "can't": "cannot",
            "couldn't": "could not",
            "didn't": "did not",
            "doesn't": "does not",
            "don't": "do not",
            "hadn't": "had not",
            "hasn't": "has not",
            "haven't": "have not",
            "he'd": "he would",
            "he'll": "he will",
            "he's": "he is",
            "I'd": "I would",
            "I'll": "I will",
            "I'm": "I am",
            "I've": "I have",
            "isn't": "is not",
            "it's": "it is",
            "let's": "let us",
            "mightn't": "might not",
            "mustn't": "must not",
            "shan't": "shall not",
            "she'd": "she would",
            "she'll": "she will",
            "she's": "she is",
            "shouldn't": "should not",
            "that's": "that is",
            "there's": "there is",
            "they'd": "they would",
            "they'll": "they will",
            "they're": "they are",
            "they've": "they have",
            "wasn't": "was not",
            "we'd": "we would",
            "we'll": "we will",
            "we're": "we are",
            "we've": "we have",
            "weren't": "were not",
            "what'll": "what will",
            "what're": "what are",
            "what's": "what is",
            "what've": "what have",
            "where's": "where is",
            "who'd": "who would",
            "who'll": "who will",
            "who're": "who are",
            "who's": "who is",
            "who've": "who have",
            "won't": "will not",
            "wouldn't": "would not",
            "you'd": "you would",
            "you'll": "you will",
            "you're": "you are",
            "you've": "you have",
            "y'all": "you all",
            "gonna": "going to",
            "gotta": "got to",
            "wanna": "want to"
        };
        
        // More comprehensive academic synonyms map
        this.synonyms_map = {
            // Nouns
            "thing": ["element", "component", "entity", "factor", "aspect"],
            "idea": ["concept", "notion", "perspective", "theory", "framework"],
            "problem": ["issue", "challenge", "dilemma", "obstacle", "impediment"],
            "result": ["outcome", "consequence", "implication", "finding", "determination"],
            "part": ["component", "constituent", "segment", "element", "portion"],
            "way": ["methodology", "approach", "strategy", "mechanism", "procedure"],
            "person": ["individual", "subject", "participant", "respondent", "entity"],
            "time": ["duration", "period", "interval", "timeframe", "chronology"],
            "end": ["conclusion", "termination", "cessation", "culmination", "finalization"],
            "place": ["location", "site", "venue", "position", "locale"],
            
            // Adjectives
            "good": ["favorable", "beneficial", "advantageous", "superior", "exemplary"],
            "bad": ["adverse", "unfavorable", "detrimental", "suboptimal", "deficient"],
            "big": ["substantial", "considerable", "significant", "extensive", "pronounced"],
            "small": ["minimal", "limited", "restricted", "constrained", "negligible"],
            "important": ["significant", "crucial", "essential", "fundamental", "pivotal"],
            "hard": ["challenging", "demanding", "arduous", "strenuous", "rigorous"],
            "easy": ["straightforward", "uncomplicated", "manageable", "accessible", "undemanding"],
            "high": ["elevated", "substantial", "considerable", "significant", "pronounced"],
            "low": ["minimal", "limited", "restricted", "constrained", "negligible"],
            "new": ["novel", "innovative", "recent", "contemporary", "emergent"],
            "old": ["traditional", "established", "conventional", "preceding", "antecedent"],
            "different": ["distinct", "disparate", "divergent", "heterogeneous", "contrasting"],
            "same": ["identical", "equivalent", "analogous", "corresponding", "homologous"],
            "large": ["substantial", "extensive", "considerable", "significant", "voluminous"],
            
            // Verbs
            "say": ["assert", "contend", "posit", "articulate", "postulate"],
            "think": ["consider", "contemplate", "conceptualize", "theorize", "hypothesize"],
            "see": ["observe", "examine", "investigate", "analyze", "scrutinize"],
            "know": ["comprehend", "understand", "ascertain", "discern", "recognize"],
            "get": ["obtain", "acquire", "procure", "attain", "secure"],
            "make": ["construct", "produce", "generate", "formulate", "synthesize"],
            "go": ["proceed", "advance", "progress", "continue", "ensue"],
            "come": ["approach", "advance", "progress", "emerge", "materialize"],
            "take": ["acquire", "obtain", "extract", "derive", "procure"],
            "find": ["discover", "identify", "ascertain", "determine", "establish"],
            "give": ["provide", "supply", "furnish", "contribute", "deliver"],
            "tell": ["inform", "communicate", "convey", "relate", "elucidate"],
            "work": ["function", "operate", "perform", "execute", "process"],
            "call": ["designate", "characterize", "denominate", "classify", "categorize"],
            "try": ["attempt", "endeavor", "strive", "undertake", "pursue"],
            "ask": ["inquire", "investigate", "examine", "explore", "interrogate"],
            "need": ["require", "necessitate", "entail", "warrant", "demand"],
            "feel": ["perceive", "discern", "sense", "apprehend", "experience"],
            "become": ["transform into", "develop into", "evolve into", "convert to", "transition to"],
            "leave": ["depart from", "withdraw from", "exit from", "abandon", "vacate"],
            "put": ["position", "situate", "place", "locate", "establish"],
            "mean": ["signify", "denote", "indicate", "represent", "imply"],
            "keep": ["maintain", "sustain", "preserve", "retain", "conserve"],
            "let": ["permit", "allow", "enable", "facilitate", "accommodate"],
            "begin": ["commence", "initiate", "instigate", "embark upon", "undertake"],
            "seem": ["appear", "manifest", "present as", "be perceived as", "be regarded as"],
            "help": ["assist", "facilitate", "support", "aid", "contribute to"],
            "show": ["demonstrate", "illustrate", "elucidate", "depict", "explicate"],
            "hear": ["perceive", "discern", "apprehend", "detect", "distinguish"],
            "play": ["engage in", "participate in", "perform", "execute", "conduct"],
            "run": ["operate", "function", "proceed", "progress", "execute"],
            "move": ["transfer", "relocate", "reposition", "transpose", "displace"],
            "like": ["prefer", "favor", "be partial to", "have a preference for", "be inclined toward"],
            "live": ["reside", "dwell", "inhabit", "occupy", "populate"],
            "believe": ["consider", "maintain", "hold that", "be of the opinion", "contend"],
            "bring": ["introduce", "present", "submit", "advance", "propose"],
            "happen": ["occur", "transpire", "take place", "come about", "materialize"],
            "use": ["utilize", "employ", "apply", "implement", "exercise"],
            "look": ["examine", "inspect", "scrutinize", "investigate", "analyze"]
        };
    }

    // Main transformation method
    humanizeText(text, usePassive = false, useSynonyms = false) {
        // Check if compromise is available
        if (typeof window.nlp === 'undefined') {
            console.error("Compromise library not loaded. Returning original text.");
            return text;
        }
        
        try {
            // Parse text with compromise
            const doc = window.nlp(text);
            const sentences = doc.sentences().json();
            
            // Process each sentence
            const transformedSentences = sentences.map(sentObj => {
                let sentence = sentObj.text;
                
                // 1. Expand contractions (always)
                sentence = this.expandContractions(sentence);
                
                // 2. Add academic transitions (probability based)
                if (Math.random() < this.p_academic_transition) {
                    sentence = this.addAcademicTransition(sentence);
                }
                
                // 3. Convert to passive voice (if enabled)
                if (usePassive && Math.random() < this.p_passive) {
                    sentence = this.convertToPassive(sentence);
                }
                
                // 4. Replace with synonyms (if enabled)
                if (useSynonyms) {
                    sentence = this.replaceWithSynonyms(sentence);
                }
                
                return sentence;
            });
            
            // Join the transformed sentences
            return transformedSentences.join(' ');
        } catch (error) {
            console.error("Error in humanizing text:", error);
            return text; // Return original text if there's an error
        }
    }

    expandContractions(sentence) {
        // Sort contractions by length (descending) to handle overlapping contractions
        const contractions = Object.keys(this.contraction_map).sort((a, b) => b.length - a.length);
        
        let result = sentence;
        
        // First pass: handle whole word contractions
        for (const contraction of contractions) {
            const regex = new RegExp(`\\b${contraction}\\b`, 'gi');
            result = result.replace(regex, (match) => {
                const expansion = this.contraction_map[match.toLowerCase()];
                if (!expansion) return match; // Skip if no expansion found
                
                // Preserve capitalization
                if (match[0] === match[0].toUpperCase()) {
                    return expansion.charAt(0).toUpperCase() + expansion.slice(1);
                }
                return expansion;
            });
        }
        
        // Second pass: handle suffix contractions
        for (const [contraction, expansion] of Object.entries(this.contraction_map)) {
            if (contraction.startsWith("'")) {
                const regex = new RegExp(`\\w+${contraction.replace(/'/g, "\\'")}\\b`, 'gi');
                result = result.replace(regex, (match) => {
                    // Safety check to prevent index errors
                    if (!match || match.length <= contraction.length) {
                        return match;
                    }
                    
                    const base = match.slice(0, -contraction.length);
                    if (!base) return match; // Skip if base is empty
                    
                    return base + expansion;
                });
            }
        }
        
        return result;
    }

    addAcademicTransition(sentence) {
        // Don't add transitions to sentences that already start with one
        const lowerSentence = sentence.toLowerCase();
        for (const transition of this.academic_transitions) {
            if (lowerSentence.startsWith(transition.toLowerCase())) {
                return sentence;
            }
        }
        
        // Select a random transition
        const transition = this.academic_transitions[
            Math.floor(Math.random() * this.academic_transitions.length)
        ];
        
        return `${transition} ${sentence.charAt(0).toLowerCase() + sentence.slice(1)}`;
    }

    convertToPassive(sentence) {
        // Use compromise to identify subject-verb-object patterns
        if (typeof window.nlp === 'undefined') {
            return sentence;
        }
        
        try {
            // Use compromise to identify subject-verb-object patterns
            const doc = window.nlp(sentence);
            
            // Get all verbs that could be converted to passive
            const verbPhrases = doc.clauses().json();
            
            // If no suitable phrases found, return original
            if (verbPhrases.length === 0) return sentence;
            
            // Try to convert each phrase
            for (const phrase of verbPhrases) {
                const clauseDoc = window.nlp(phrase.text);
                
                // Extract subjects, verbs and objects
                const subjects = clauseDoc.match('#Noun').before('#Verb').first();
                const verbs = clauseDoc.verbs().first();
                const objects = clauseDoc.match('#Noun').after('#Verb').first();
                
                if (subjects.found && verbs.found && objects.found) {
                    const subject = subjects.text();
                    const verbPhrase = verbs.text();
                    const object = objects.text();
                    
                    // Convert to passive
                    try {
                        const passiveVerbForm = verbs.clone().toParticiple().text();
                        if (passiveVerbForm) {
                            // Create the passive construction
                            const passivePhrase = `${object} is ${passiveVerbForm} by ${subject}`;
                            
                            // Replace in the original sentence
                            const activePhrase = `${subject} ${verbPhrase} ${object}`;
                            if (sentence.includes(activePhrase)) {
                                return sentence.replace(activePhrase, passivePhrase);
                            }
                        }
                    } catch (e) {
                        // If conversion fails, continue with next phrase
                        continue;
                    }
                }
            }
            
            return sentence;
        } catch (error) {
            console.error("Error in convertToPassive:", error);
            return sentence;
        }
    }

    replaceWithSynonyms(sentence) {
        // Analyze the sentence with compromise
        if (typeof window.nlp === 'undefined') {
            return sentence;
        }
        
        try {
            // Analyze the sentence with compromise
            const doc = window.nlp(sentence);
            
            // Get all nouns, adjectives, and verbs that could be replaced
            const replaceable = doc.match('#Noun|#Adjective|#Verb').not('#Pronoun').json();
            
            // Make a copy of the sentence to modify
            let result = sentence;
            
            // Process each potential word for replacement
            for (const term of replaceable) {
                if (!term || !term.text) continue; // Skip invalid terms
                
                const word = term.text.toLowerCase();
                
                // Skip short words, punctuation, and special characters
                if (word.length < 4 || /[^\w\s]/.test(word) || Math.random() > this.p_synonym_replacement) {
                    continue;
                }
                
                // Check if we have synonyms for this word
                if (this.synonyms_map[word]) {
                    const synonyms = this.synonyms_map[word];
                    const synonym = synonyms[Math.floor(Math.random() * synonyms.length)];
                    
                    // Replace the word in the sentence (preserving capitalization)
                    try {
                        const regex = new RegExp(`\\b${word}\\b`, 'i');
                        result = result.replace(regex, (match) => {
                            if (!match) return word; // Safety check
                            
                            // Preserve capitalization
                            if (match[0] === match[0].toUpperCase()) {
                                return synonym.charAt(0).toUpperCase() + synonym.slice(1);
                            }
                            return synonym;
                        });
                    } catch (error) {
                        console.error(`Error replacing word "${word}":`, error);
                        // Continue processing other words
                    }
                }
            }
            
            return result;
        } catch (error) {
            console.error("Error in replaceWithSynonyms:", error);
            return sentence;
        }
    }
}

// Make the class available globally
window.AcademicTextHumanizer = AcademicTextHumanizer;

// Utility functions for text analysis
function countWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

function countSentences(text) {
    return nlp(text).sentences().length;
}

// File handling functionality
function handleFileUpload(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            resolve(event.target.result);
        };
        
        reader.onerror = function(event) {
            reject(new Error("Failed to read file"));
        };
        
        reader.readAsText(file);
    });
}

// DOM elements
const userTextArea = document.getElementById('userText');
const fileUploadInput = document.getElementById('fileUpload');
const usePassiveCheckbox = document.getElementById('usePassive');
const useSynonymsCheckbox = document.getElementById('useSynonyms');
const transformButton = document.getElementById('transformBtn');
const outputSection = document.getElementById('outputSection');
const transformedTextDiv = document.getElementById('transformedText');
const loadingSpinner = document.getElementById('loadingSpinner');
const inputWordCountSpan = document.getElementById('inputWordCount');
const inputSentenceCountSpan = document.getElementById('inputSentenceCount');
const outputWordCountSpan = document.getElementById('outputWordCount');
const outputSentenceCountSpan = document.getElementById('outputSentenceCount');

// Initialize the humanizer
const humanizer = new AcademicTextHumanizer({
    p_passive: 0.35,
    p_synonym_replacement: 0.4,
    p_academic_transition: 0.45
});

// Handle file upload
fileUploadInput.addEventListener('change', async (event) => {
    if (event.target.files.length > 0) {
        try {
            const fileText = await handleFileUpload(event.target.files[0]);
            userTextArea.value = fileText;
        } catch (error) {
            alert("Error reading file: " + error.message);
        }
    }
});

// Handle transform button click
transformButton.addEventListener('click', async () => {
    const userText = userTextArea.value.trim();
    
    if (!userText) {
        alert("Please enter or upload some text to transform.");
        return;
    }
    
    // Show loading spinner
    loadingSpinner.classList.remove('d-none');
    
    try {
        // Get options
        const usePassive = usePassiveCheckbox.checked;
        const useSynonyms = useSynonymsCheckbox.checked;
        
        // Calculate input stats
        const inputWordCount = countWords(userText);
        const inputSentenceCount = countSentences(userText);
        
        // Transform text (use setTimeout to prevent UI freezing for larger texts)
        setTimeout(() => {
            try {
                // Perform the transformation
                const transformed = humanizer.humanizeText(
                    userText,
                    usePassive,
                    useSynonyms
                );
                
                // Calculate output stats
                const outputWordCount = countWords(transformed);
                const outputSentenceCount = countSentences(transformed);
                
                // Update UI
                transformedTextDiv.textContent = transformed;
                inputWordCountSpan.textContent = inputWordCount;
                inputSentenceCountSpan.textContent = inputSentenceCount;
                outputWordCountSpan.textContent = outputWordCount;
                outputSentenceCountSpan.textContent = outputSentenceCount;
                
                // Show output section
                outputSection.classList.remove('d-none');
            } catch (error) {
                console.error("Error in text transformation:", error);
                alert("An error occurred during transformation. Please check the console for details.");
            } finally {
                // Hide loading spinner
                loadingSpinner.classList.add('d-none');
            }
        }, 50);
    } catch (error) {
        console.error("Error preparing transformation:", error);
        alert("Error preparing transformation: " + error.message);
        loadingSpinner.classList.add('d-none');
    }
});

// Add some example text functionality
document.addEventListener('DOMContentLoaded', () => {
    const exampleButton = document.createElement('button');
    exampleButton.innerText = 'Load Example Text';
    exampleButton.className = 'btn btn-secondary me-2';
    exampleButton.addEventListener('click', () => {
        userTextArea.value = "I've been thinking about how AI will change our work. It's gonna be a big shift, but I think it'll help us do more with less time. We can't ignore how it's already changing things. Let's make sure we're ready for what comes next!";
    });
    
    const clearButton = document.createElement('button');
    clearButton.innerText = 'Clear Text';
    clearButton.className = 'btn btn-outline-secondary';
    clearButton.addEventListener('click', () => {
        userTextArea.value = '';
    });
    
    transformButton.parentNode.insertBefore(exampleButton, transformButton);
    transformButton.parentNode.insertBefore(clearButton, transformButton.nextSibling);
});
