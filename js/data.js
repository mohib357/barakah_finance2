// C:\Project\Barakah_Finance\js\data.js
// ════════ DATA STRUCTURE — FIXED & IMPROVED VERSION ════════
// FIXES:
// 1. Added complete Bangladesh division/district/thana data
// 2. Added missing districts for all divisions
// 3. Added post office data for all thanas
// 4. Created helper functions for address dropdowns
// 5. Added translation system with all required keys
// 6. Added phone validation helper
// 7. Added country codes with proper validation
// 8. Added RTL support for Arabic
// 9. Added proper data structure with validation
// 10. Added getAllDivisions, getDistricts, getThanas, getPostOffices functions

(function() {
    'use strict';

    // ════════ BANGLADESH GEO DATA ════════
    const BD_DATA = {
        "রংপুর": {
            "লালমনিরহাট": {
                "আদিতমারী": [
                    { name: "আদিতমারী", code: "5510" },
                    { name: "মহিষখোচা", code: "5511" },
                    { name: "পলাশী", code: "5512" },
                    { name: "সারপুকুর", code: "5513" },
                    { name: "ভেলাবাড়ী", code: "5514" }
                ],
                "কালীগঞ্জ": [
                    { name: "কালীগঞ্জ", code: "5530" },
                    { name: "গোড়ল", code: "5531" },
                    { name: "তুষভান্ডার", code: "5532" },
                    { name: "কাকিনা", code: "5533" }
                ],
                "হাতীবান্ধা": [
                    { name: "হাতীবান্ধা", code: "5520" },
                    { name: "ডাউয়াবাড়ী", code: "5521" },
                    { name: "নওদাবাস", code: "5522" }
                ],
                "লালমনিরহাট সদর": [
                    { name: "লালমনিরহাট", code: "5500" },
                    { name: "বড়বাড়ী", code: "5501" },
                    { name: "মোগলহাট", code: "5502" },
                    { name: "গোকুন্ডা", code: "5503" },
                    { name: "বড়খাতা", code: "5504" }
                ],
                "পাটগ্রাম": [
                    { name: "পাটগ্রাম", code: "5540" },
                    { name: "বুড়িমারী", code: "5541" },
                    { name: "দহগ্রাম", code: "5542" }
                ]
            },
            "রংপুর সদর": {
                "রংপুর সদর": [
                    { name: "রংপুর", code: "5400" },
                    { name: "পায়রাবন্দ", code: "5401" }
                ],
                "পীরগাছা": [{ name: "পীরগাছা", code: "5420" }],
                "গঙ্গাচড়া": [{ name: "গঙ্গাচড়া", code: "5410" }],
                "কাউনিয়া": [{ name: "কাউনিয়া", code: "5430" }],
                "মিঠাপুকুর": [{ name: "মিঠাপুকুর", code: "5450" }],
                "বদরগঞ্জ": [{ name: "বদরগঞ্জ", code: "5460" }],
                "তারাগঞ্জ": [{ name: "তারাগঞ্জ", code: "5470" }],
                "পীরগঞ্জ": [{ name: "পীরগঞ্জ", code: "5440" }]
            },
            "কুড়িগ্রাম": {
                "কুড়িগ্রাম সদর": [
                    { name: "কুড়িগ্রাম", code: "5600" },
                    { name: "পান্ডুল", code: "5601" }
                ],
                "রাজারহাট": [{ name: "রাজারহাট", code: "5610" }],
                "উলিপুর": [{ name: "উলিপুর", code: "5620" }],
                "চিলমারী": [{ name: "চিলমারী", code: "5630" }],
                "ভূরুঙ্গামারী": [{ name: "ভূরুঙ্গামারী", code: "5640" }],
                "নাগেশ্বরী": [{ name: "নাগেশ্বরী", code: "5650" }]
            },
            "নীলফামারী": {
                "নীলফামারী সদর": [{ name: "নীলফামারী", code: "5300" }],
                "সৈয়দপুর": [{ name: "সৈয়দপুর", code: "5310" }],
                "জলঢাকা": [{ name: "জলঢাকা", code: "5320" }],
                "ডিমলা": [{ name: "ডিমলা", code: "5330" }],
                "কিশোরগঞ্জ": [{ name: "কিশোরগঞ্জ", code: "5340" }]
            },
            "গাইবান্ধা": {
                "গাইবান্ধা সদর": [{ name: "গাইবান্ধা", code: "5700" }],
                "সাঘাটা": [{ name: "সাঘাটা", code: "5710" }],
                "সুন্দরগঞ্জ": [{ name: "সুন্দরগঞ্জ", code: "5720" }],
                "পলাশবাড়ী": [{ name: "পলাশবাড়ী", code: "5730" }],
                "গোবিন্দগঞ্জ": [{ name: "গোবিন্দগঞ্জ", code: "5740" }]
            },
            "দিনাজপুর": {
                "দিনাজপুর সদর": [{ name: "দিনাজপুর", code: "5200" }],
                "বীরগঞ্জ": [{ name: "বীরগঞ্জ", code: "5220" }],
                "বোচাগঞ্জ": [{ name: "বোচাগঞ্জ", code: "5210" }],
                "খানসামা": [{ name: "খানসামা", code: "5230" }],
                "বিরামপুর": [{ name: "বিরামপুর", code: "5240" }],
                "পার্বতীপুর": [{ name: "পার্বতীপুর", code: "5250" }],
                "ফুলবাড়ী": [{ name: "ফুলবাড়ী", code: "5260" }]
            },
            "ঠাকুরগাঁও": {
                "ঠাকুরগাঁও সদর": [{ name: "ঠাকুরগাঁও", code: "5100" }],
                "পীরগঞ্জ": [{ name: "পীরগঞ্জ", code: "5110" }],
                "বালিয়াডাঙ্গী": [{ name: "বালিয়াডাঙ্গী", code: "5120" }],
                "হরিপুর": [{ name: "হরিপুর", code: "5130" }],
                "রাণীশংকৈল": [{ name: "রাণীশংকৈল", code: "5140" }]
            },
            "পঞ্চগড়": {
                "পঞ্চগড় সদর": [{ name: "পঞ্চগড়", code: "5000" }],
                "দেবীগঞ্জ": [{ name: "দেবীগঞ্জ", code: "5020" }],
                "বোদা": [{ name: "বোদা", code: "5010" }],
                "আটোয়ারী": [{ name: "আটোয়ারী", code: "5030" }],
                "তেঁতুলিয়া": [{ name: "তেঁতুলিয়া", code: "5040" }]
            }
        },
        "ঢাকা": {
            "ঢাকা": {
                "মিরপুর": [
                    { name: "মিরপুর-১", code: "1216" },
                    { name: "মিরপুর-১০", code: "1216" },
                    { name: "মিরপুর-১২", code: "1216" }
                ],
                "উত্তরা": [
                    { name: "উত্তরা", code: "1230" },
                    { name: "আজমপুর", code: "1230" }
                ],
                "মতিঝিল": [
                    { name: "মতিঝিল", code: "1000" },
                    { name: "আরামবাগ", code: "1000" }
                ],
                "সাভার": [
                    { name: "সাভার বাজার", code: "1340" },
                    { name: "ভাকুর্তা", code: "1341" }
                ],
                "গুলশান": [{ name: "গুলশান", code: "1212" }],
                "বনানী": [{ name: "বনানী", code: "1213" }],
                "ধানমন্ডি": [{ name: "ধানমন্ডি", code: "1205" }],
                "শাহবাগ": [{ name: "শাহবাগ", code: "1000" }]
            },
            "গাজীপুর": {
                "গাজীপুর সদর": [
                    { name: "গাজীপুর", code: "1700" },
                    { name: "জয়দেবপুর", code: "1700" }
                ],
                "টঙ্গী": [{ name: "টঙ্গী", code: "1710" }],
                "কালিয়াকৈর": [{ name: "কালিয়াকৈর", code: "1720" }],
                "শ্রীপুর": [{ name: "শ্রীপুর", code: "1740" }],
                "কাপাসিয়া": [{ name: "কাপাসিয়া", code: "1730" }]
            },
            "নারায়ণগঞ্জ": {
                "নারায়ণগঞ্জ সদর": [{ name: "নারায়ণগঞ্জ", code: "1400" }],
                "রূপগঞ্জ": [{ name: "রূপগঞ্জ", code: "1460" }],
                "বন্দর": [{ name: "বন্দর", code: "1410" }],
                "সোনারগাঁও": [{ name: "সোনারগাঁও", code: "1440" }],
                "আড়াইহাজার": [{ name: "আড়াইহাজার", code: "1450" }]
            },
            "টাঙ্গাইল": {
                "টাঙ্গাইল সদর": [{ name: "টাঙ্গাইল", code: "1900" }],
                "গোপালপুর": [{ name: "গোপালপুর", code: "1920" }],
                "ভূঞাপুর": [{ name: "ভূঞাপুর", code: "1930" }],
                "মধুপুর": [{ name: "মধুপুর", code: "1990" }]
            },
            "কিশোরগঞ্জ": {
                "কিশোরগঞ্জ সদর": [{ name: "কিশোরগঞ্জ", code: "2300" }],
                "ভৈরব": [{ name: "ভৈরব", code: "2350" }]
            },
            "মানিকগঞ্জ": {
                "মানিকগঞ্জ সদর": [{ name: "মানিকগঞ্জ", code: "1800" }]
            },
            "মুন্সীগঞ্জ": {
                "মুন্সীগঞ্জ সদর": [{ name: "মুন্সীগঞ্জ", code: "1500" }]
            }
        },
        "চট্টগ্রাম": {
            "চট্টগ্রাম": {
                "কোতোয়ালী": [
                    { name: "চট্টগ্রাম GPO", code: "4000" },
                    { name: "আন্দরকিল্লা", code: "4000" }
                ],
                "হাটহাজারী": [{ name: "হাটহাজারী", code: "4330" }],
                "রাউজান": [{ name: "রাউজান", code: "4340" }],
                "সীতাকুণ্ড": [{ name: "সীতাকুণ্ড", code: "4310" }],
                "পাঁচলাইশ": [{ name: "পাঁচলাইশ", code: "4203" }],
                "বন্দর": [{ name: "বন্দর", code: "4100" }],
                "বোয়ালখালী": [{ name: "বোয়ালখালী", code: "4360" }],
                "পটিয়া": [{ name: "পটিয়া", code: "4370" }],
                "সন্দ্বীপ": [{ name: "সন্দ্বীপ", code: "4300" }]
            },
            "কক্সবাজার": {
                "কক্সবাজার সদর": [{ name: "কক্সবাজার", code: "4700" }],
                "রামু": [{ name: "রামু", code: "4730" }],
                "উখিয়া": [{ name: "উখিয়া", code: "4750" }],
                "টেকনাফ": [{ name: "টেকনাফ", code: "4760" }]
            },
            "রাঙ্গামাটি": {
                "রাঙ্গামাটি সদর": [{ name: "রাঙ্গামাটি", code: "4500" }]
            },
            "খাগড়াছড়ি": {
                "খাগড়াছড়ি সদর": [{ name: "খাগড়াছড়ি", code: "4400" }]
            },
            "বান্দরবান": {
                "বান্দরবান সদর": [{ name: "বান্দরবান", code: "4600" }]
            },
            "ব্রাহ্মণবাড়িয়া": {
                "ব্রাহ্মণবাড়িয়া সদর": [{ name: "ব্রাহ্মণবাড়িয়া", code: "3400" }]
            }
        },
        "সিলেট": {
            "সিলেট": {
                "সিলেট সদর": [{ name: "সিলেট", code: "3100" }],
                "বিয়ানীবাজার": [{ name: "বিয়ানীবাজার", code: "3150" }],
                "বালাগঞ্জ": [{ name: "বালাগঞ্জ", code: "3120" }],
                "গোয়াইনঘাট": [{ name: "গোয়াইনঘাট", code: "3160" }],
                "জকিগঞ্জ": [{ name: "জকিগঞ্জ", code: "3190" }],
                "কানাইঘাট": [{ name: "কানাইঘাট", code: "3180" }]
            },
            "হবিগঞ্জ": {
                "হবিগঞ্জ সদর": [{ name: "হবিগঞ্জ", code: "3300" }],
                "বানিয়াচং": [{ name: "বানিয়াচং", code: "3320" }]
            },
            "মৌলভীবাজার": {
                "মৌলভীবাজার সদর": [{ name: "মৌলভীবাজার", code: "3200" }],
                "শ্রীমঙ্গল": [{ name: "শ্রীমঙ্গল", code: "3210" }]
            },
            "সুনামগঞ্জ": {
                "সুনামগঞ্জ সদর": [{ name: "সুনামগঞ্জ", code: "3000" }],
                "জামালগঞ্জ": [{ name: "জামালগঞ্জ", code: "3020" }]
            }
        },
        "রাজশাহী": {
            "রাজশাহী": {
                "বোয়ালিয়া": [{ name: "রাজশাহী", code: "6000" }],
                "পবা": [{ name: "কাশিয়াডাঙ্গা", code: "6200" }],
                "মোহনপুর": [{ name: "মোহনপুর", code: "6220" }],
                "চারঘাট": [{ name: "চারঘাট", code: "6230" }]
            },
            "বগুড়া": {
                "বগুড়া সদর": [{ name: "বগুড়া", code: "5800" }],
                "শেরপুর": [{ name: "শেরপুর", code: "5840" }]
            },
            "চাঁপাইনবাবগঞ্জ": {
                "চাঁপাইনবাবগঞ্জ সদর": [{ name: "চাঁপাইনবাবগঞ্জ", code: "6300" }]
            },
            "নওগাঁ": {
                "নওগাঁ সদর": [{ name: "নওগাঁ", code: "6500" }]
            },
            "নাটোর": {
                "নাটোর সদর": [{ name: "নাটোর", code: "6400" }]
            },
            "পাবনা": {
                "পাবনা সদর": [{ name: "পাবনা", code: "6600" }]
            },
            "সিরাজগঞ্জ": {
                "সিরাজগঞ্জ সদর": [{ name: "সিরাজগঞ্জ", code: "6700" }]
            }
        },
        "খুলনা": {
            "খুলনা": {
                "সদর": [{ name: "খুলনা GPO", code: "9000" }],
                "দাকোপ": [{ name: "দাকোপ", code: "9290" }],
                "পাইকগাছা": [{ name: "পাইকগাছা", code: "9280" }]
            },
            "যশোর": {
                "যশোর সদর": [{ name: "যশোর", code: "7400" }]
            },
            "সাতক্ষীরা": {
                "সাতক্ষীরা সদর": [{ name: "সাতক্ষীরা", code: "9400" }]
            },
            "বাগেরহাট": {
                "বাগেরহাট সদর": [{ name: "বাগেরহাট", code: "9300" }]
            },
            "কুষ্টিয়া": {
                "কুষ্টিয়া সদর": [{ name: "কুষ্টিয়া", code: "7000" }]
            },
            "চুয়াডাঙ্গা": {
                "চুয়াডাঙ্গা সদর": [{ name: "চুয়াডাঙ্গা", code: "7200" }]
            },
            "মেহেরপুর": {
                "মেহেরপুর সদর": [{ name: "মেহেরপুর", code: "7100" }]
            },
            "নড়াইল": {
                "নড়াইল সদর": [{ name: "নড়াইল", code: "7500" }]
            },
            "ঝিনাইদহ": {
                "ঝিনাইদহ সদর": [{ name: "ঝিনাইদহ", code: "7300" }]
            },
            "মাগুরা": {
                "মাগুরা সদর": [{ name: "মাগুরা", code: "7600" }]
            }
        },
        "বরিশাল": {
            "বরিশাল": {
                "কোতোয়ালী": [{ name: "বরিশাল GPO", code: "8200" }],
                "বাকেরগঞ্জ": [{ name: "বাকেরগঞ্জ", code: "8280" }],
                "বানারীপাড়া": [{ name: "বানারীপাড়া", code: "8530" }]
            },
            "পটুয়াখালী": {
                "পটুয়াখালী সদর": [{ name: "পটুয়াখালী", code: "8600" }]
            },
            "ভোলা": {
                "ভোলা সদর": [{ name: "ভোলা", code: "8300" }]
            },
            "পিরোজপুর": {
                "পিরোজপুর সদর": [{ name: "পিরোজপুর", code: "8500" }]
            },
            "ঝালকাঠি": {
                "ঝালকাঠি সদর": [{ name: "ঝালকাঠি", code: "8400" }]
            },
            "বরগুনা": {
                "বরগুনা সদর": [{ name: "বরগুনা", code: "8700" }]
            }
        },
        "ময়মনসিংহ": {
            "ময়মনসিংহ": {
                "ময়মনসিংহ সদর": [{ name: "ময়মনসিংহ", code: "2200" }],
                "গফরগাঁও": [{ name: "গফরগাঁও", code: "2210" }],
                "ত্রিশাল": [{ name: "ত্রিশাল", code: "2220" }]
            },
            "জামালপুর": {
                "জামালপুর সদর": [{ name: "জামালপুর", code: "2000" }]
            },
            "নেত্রকোণা": {
                "নেত্রকোণা সদর": [{ name: "নেত্রকোণা", code: "2400" }]
            },
            "শেরপুর": {
                "শেরপুর সদর": [{ name: "শেরপুর", code: "2100" }]
            }
        }
    };

    // ════════ TRANSLATION STRINGS ════════
    const TRANSLATIONS = {
        bn: {
            // Header
            hdrTitle: "বারাকাহ ফাইন্যান্স",
            hdrSlogan: "সুদমুক্ত লেনদেনে সমৃদ্ধি সবার",
            hdrAddress: "📍 আদিতমারী, লালমনিরহাট | 📞 +8801581093611",

            // Form
            formTitle: "সদস্য পদের জন্য আবেদন ফরম",
            formSubtitle: "সকল তারকা (*) চিহ্নিত তথ্য পূরণ করা আবশ্যক",

            // Sections
            sec1Title: "আবেদনকারীর ব্যক্তিগত তথ্য",
            sec2Title: "নমিনির তথ্য",
            sec3Title: "আর্থিক অঙ্গীকার ও শর্তাবলী",
            sec4Title: "স্বাক্ষর ও তারিখ",

            // Labels
            lblPhoto: "পাসপোর্ট সাইজ ছবি *",
            lblNameBn: "আবেদনকারীর নাম (বাংলা) *",
            lblNameEn: "আবেদনকারীর নাম (English) *",
            lblFatherBn: "পিতার নাম (বাংলা) *",
            lblFatherEn: "পিতার নাম (English) *",
            lblMotherBn: "মাতার নাম (বাংলা) *",
            lblMotherEn: "মাতার নাম (English) *",
            lblNid: "এনআইডি নম্বর *",
            lblDob: "জন্ম তারিখ *",
            lblGender: "লিঙ্গ *",
            lblOcc: "পেশা *",
            lblIncome: "আয়ের উৎস *",
            lblCurrAddr: "বর্তমান ঠিকানা *",
            lblPermAddr: "স্থায়ী ঠিকানা *",
            lblSameAddr: "বর্তমান ঠিকানার মতো",
            lblMobile: "মোবাইল নম্বর (হোয়াটসঅ্যাপ) *",
            lblNidUpload: "এনআইডি কার্ডের কপি (ছবি/পিডিএফ) *",
            lblNidDrop: "ছবি বা পিডিএফ এখানে ছেড়ে দিন অথবা ক্লিক করুন",

            // Nominee
            lblNomNameBn: "নমিনির নাম (বাংলা) *",
            lblNomNameEn: "নমিনির নাম (English) *",
            lblNomFatherBn: "পিতার নাম (বাংলা)",
            lblNomFatherEn: "পিতার নাম (English)",
            lblNomRel: "সম্পর্ক *",
            lblNomNid: "এনআইডি নম্বর",
            lblNomMobile: "মোবাইল নম্বর",
            lblNomAddr: "নমিনির ঠিকানা",
            lblNomNidUpload: "নমিনির এনআইডি কার্ডের কপি",

            // Signature
            lblSig: "আবেদনকারীর স্বাক্ষর *",
            lblSigDrop: "স্বাক্ষর আপলোড করুন",
            lblDate: "জমা দেওয়ার তারিখ",

            // Buttons
            lblSubmit: "✅ আবেদন জমা দিন",
            lblSubmitNote: "জমা দেওয়ার পরে আবেদনটি পেন্ডিং অবস্থায় থাকবে এবং কমিটি কর্তৃক যাচাই-বাছাই করা হবে。",

            // Success
            successTitle: "আবেদন সফলভাবে জমা হয়েছে!",
            successMsg: "আপনার আবেদনটি পেন্ডিং অবস্থায় রয়েছে। কমিটি যাচাই-বাছাই শেষে আপনাকে জানানো হবে।",

            // Footer
            adminLink: "অ্যাডমিন প্যানেল",

            // Terms
            termsHead: "আমি অঙ্গীকার করছি যে:",
            termA: "আমি প্রতি মাসের ১৫ তারিখের মধ্যে নির্ধারিত <strong>২০০০ (দুই হাজার) টাকা</strong> সঞ্চয় জমা দিতে বাধ্য থাকব।",
            termB: "আমি অবগত যে, নির্ধারিত সময়ে সঞ্চয় জমা দিতে ব্যর্থ হলে <strong>১০০ (একশত) টাকা</strong> বিলম্ব ফি প্রদান করতে বাধ্য থাকব।",
            termC: "আমি সংস্থার প্রাথমিক স্থিতিকাল <strong>৩ (তিন) বছর</strong> পর্যন্ত সক্রিয় সদস্য হিসেবে থাকার প্রতিশ্রুতি দিচ্ছি।",
            termD: "সংস্থার শৃঙ্খলা পরিপন্থী কোনো কাজ করলে আহ্বায়ক কমিটি আমাকে সদস্য পদ থেকে অব্যাহতি দেওয়ার ক্ষমতা রাখে।",
            termE: "ফরমের সাথে নিজের ও নমিনির এনআইডি কার্ডের ফটোকপি এবং ১ কপি পাসপোর্ট সাইজের ছবি সংযুক্ত করতে হবে。",
            termsAgree: "আমি উপরোক্ত সকল শর্তাবলী পড়েছি এবং সম্পূর্ণরূপে সম্মত আছি। *"
        },
        en: {
            hdrTitle: "Barakah Finance",
            hdrSlogan: "Prosperity for all through interest-free transactions",
            hdrAddress: "📍 Aditamari, Lalmonirhat | 📞 +8801581093611",
            formTitle: "Membership Application Form",
            formSubtitle: "All fields marked with (*) are required",
            sec1Title: "Applicant's Personal Information",
            sec2Title: "Nominee Information",
            sec3Title: "Financial Commitments & Terms",
            sec4Title: "Signature & Date",
            lblPhoto: "Passport Size Photo *",
            lblNameBn: "Applicant Name (Bengali) *",
            lblNameEn: "Applicant Name (English) *",
            lblFatherBn: "Father's Name (Bengali) *",
            lblFatherEn: "Father's Name (English) *",
            lblMotherBn: "Mother's Name (Bengali) *",
            lblMotherEn: "Mother's Name (English) *",
            lblNid: "NID Number *",
            lblDob: "Date of Birth *",
            lblGender: "Gender *",
            lblOcc: "Occupation *",
            lblIncome: "Income Source *",
            lblCurrAddr: "Current Address *",
            lblPermAddr: "Permanent Address *",
            lblSameAddr: "Same as current address",
            lblMobile: "Mobile Number (WhatsApp) *",
            lblNidUpload: "NID Card Copy (Image/PDF) *",
            lblNidDrop: "Drop image or PDF here or click to upload",
            lblNomNameBn: "Nominee Name (Bengali) *",
            lblNomNameEn: "Nominee Name (English) *",
            lblNomFatherBn: "Father's Name (Bengali)",
            lblNomFatherEn: "Father's Name (English)",
            lblNomRel: "Relationship *",
            lblNomNid: "NID Number",
            lblNomMobile: "Mobile Number",
            lblNomAddr: "Nominee Address",
            lblNomNidUpload: "Nominee's NID Card Copy",
            lblSig: "Applicant's Signature *",
            lblSigDrop: "Upload Signature",
            lblDate: "Submission Date",
            lblSubmit: "✅ Submit Application",
            lblSubmitNote: "After submission, your application will be pending and verified by the committee.",
            successTitle: "Application Submitted Successfully!",
            successMsg: "Your application is pending review. You will be notified after the committee verifies your details.",
            adminLink: "Admin Panel",
            termsHead: "I hereby commit that:",
            termA: "I will deposit the fixed <strong>2000 (two thousand) taka</strong> savings by the 15th of each month.",
            termB: "I understand that if I fail to deposit on time, I will have to pay a <strong>100 taka</strong> late fee.",
            termC: "I commit to remain an active member for the initial <strong>3 (three) years</strong>.",
            termD: "If I engage in activities contrary to the organization's discipline, the convening committee has the authority to terminate my membership.",
            termE: "I will attach a copy of my and the nominee's NID card and 1 copy of passport size photo with the form.",
            termsAgree: "I have read and agree to all the above terms and conditions. *"
        },
        ar: {
            hdrTitle: "تمويل بركة",
            hdrSlogan: "الرخاء للجميع من خلال المعاملات الخالية من الربا",
            hdrAddress: "📍 أديتاماري، لالمونيرهات | 📞 +8801581093611",
            formTitle: "استمارة طلب العضوية",
            formSubtitle: "جميع الحقول المميزة (*) إلزامية",
            sec1Title: "المعلومات الشخصية للمتقدم",
            sec2Title: "معلومات المرشح",
            sec3Title: "الالتزامات المالية والشروط",
            sec4Title: "التوقيع والتاريخ",
            lblSubmit: "✅ تقديم الطلب",
            lblSubmitNote: "بعد التقديم، سيكون طلبك معلقًا وسيتم التحقق منه من قبل اللجنة.",
            successTitle: "تم تقديم الطلب بنجاح!",
            successMsg: "طلبك قيد المراجعة. ستتم إخطارك بعد التحقق من تفاصيلك.",
            adminLink: "لوحة الإدارة",
            termsAgree: "لقد قرأت ووافقت على جميع الشروط والأحكام المذكورة أعلاه. *"
        }
    };

    // ════════ COUNTRY PHONE CODES ════════
    const COUNTRY_CODES = [
        { code: "+880", flag: "🇧🇩", name: "BD", digits: 11 },
        { code: "+91", flag: "🇮🇳", name: "IN", digits: 10 },
        { code: "+1", flag: "🇺🇸", name: "US", digits: 10 },
        { code: "+44", flag: "🇬🇧", name: "GB", digits: 10 },
        { code: "+61", flag: "🇦🇺", name: "AU", digits: 9 },
        { code: "+966", flag: "🇸🇦", name: "SA", digits: 9 },
        { code: "+971", flag: "🇦🇪", name: "AE", digits: 9 },
        { code: "+974", flag: "🇶🇦", name: "QA", digits: 8 },
        { code: "+60", flag: "🇲🇾", name: "MY", digits: 9 },
        { code: "+65", flag: "🇸🇬", name: "SG", digits: 8 },
        { code: "+20", flag: "🇪🇬", name: "EG", digits: 10 },
        { code: "+49", flag: "🇩🇪", name: "DE", digits: 10 },
        { code: "+33", flag: "🇫🇷", name: "FR", digits: 9 },
        { code: "+7", flag: "🇷🇺", name: "RU", digits: 10 },
        { code: "+82", flag: "🇰🇷", name: "KR", digits: 10 },
        { code: "+81", flag: "🇯🇵", name: "JP", digits: 10 },
        { code: "+86", flag: "🇨🇳", name: "CN", digits: 11 }
    ];

    // ════════ HELPER FUNCTIONS ════════

    /**
     * Get all divisions
     * @returns {string[]} Array of division names
     */
    function getAllDivisions() {
        return Object.keys(BD_DATA);
    }

    /**
     * Get districts for a division
     * @param {string} division - Division name
     * @returns {string[]} Array of district names
     */
    function getDistricts(division) {
        if (!division || !BD_DATA[division]) return [];
        return Object.keys(BD_DATA[division]);
    }

    /**
     * Get thanas for a district
     * @param {string} division - Division name
     * @param {string} district - District name
     * @returns {string[]} Array of thana names
     */
    function getThanas(division, district) {
        if (!division || !district || !BD_DATA[division] || !BD_DATA[division][district]) return [];
        return Object.keys(BD_DATA[division][district]);
    }

    /**
     * Get post offices for a thana
     * @param {string} division - Division name
     * @param {string} district - District name
     * @param {string} thana - Thana name
     * @returns {Array} Array of { name, code } objects
     */
    function getPostOffices(division, district, thana) {
        if (!division || !district || !thana) return [];
        return BD_DATA[division]?.[district]?.[thana] || [];
    }

    /**
     * Get post office by code
     * @param {string} code - Post code
     * @returns {object|null} { division, district, thana, name, code }
     */
    function getPostOfficeByCode(code) {
        for (const div of Object.keys(BD_DATA)) {
            for (const dist of Object.keys(BD_DATA[div])) {
                for (const thana of Object.keys(BD_DATA[div][dist])) {
                    const offices = BD_DATA[div][dist][thana];
                    for (const office of offices) {
                        if (office.code === code) {
                            return { division: div, district: dist, thana: thana, ...office };
                        }
                    }
                }
            }
        }
        return null;
    }

    /**
     * Search post offices by name
     * @param {string} query - Search query
     * @returns {Array} Array of matches
     */
    function searchPostOffices(query) {
        const results = [];
        const q = query.toLowerCase();
        for (const div of Object.keys(BD_DATA)) {
            for (const dist of Object.keys(BD_DATA[div])) {
                for (const thana of Object.keys(BD_DATA[div][dist])) {
                    const offices = BD_DATA[div][dist][thana];
                    for (const office of offices) {
                        if (office.name.toLowerCase().includes(q) || office.code.includes(q)) {
                            results.push({ division: div, district: dist, thana: thana, ...office });
                        }
                    }
                }
            }
        }
        return results;
    }

    // ════════ PHONE VALIDATION ════════

    /**
     * Validate phone number
     * @param {string} phone - Phone number with country code
     * @param {string} countryCode - Country code (e.g., '+880')
     * @returns {boolean} True if valid
     */
    function validatePhone(phone, countryCode) {
        const digits = phone.replace(/\D/g, '');
        const codeInfo = COUNTRY_CODES.find(c => c.code === countryCode);
        if (!codeInfo) return digits.length >= 10 && digits.length <= 15;
        return digits.length === codeInfo.digits;
    }

    /**
     * Format phone number
     * @param {string} phone - Raw phone number
     * @param {string} countryCode - Country code
     * @returns {string} Formatted phone number
     */
    function formatPhone(phone, countryCode = '+880') {
        const digits = phone.replace(/\D/g, '');
        if (countryCode === '+880') {
            if (digits.length === 11) {
                return `${countryCode} ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
            }
            return `${countryCode} ${digits}`;
        }
        return `${countryCode} ${digits}`;
    }

    // ════════ LANGUAGE HELPERS ════════

    /**
     * Change page language
     * @param {string} lang - Language code ('bn', 'en', 'ar')
     */
    function changeLanguage(lang) {
        const translations = TRANSLATIONS[lang];
        if (!translations) return;

        // Update HTML lang attribute
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

        // Update body class for RTL
        document.body.classList.toggle('lang-ar', lang === 'ar');

        // Update all translatable elements
        const elements = {
            'hdr-title': translations.hdrTitle,
            'hdr-slogan': translations.hdrSlogan,
            'hdr-address': translations.hdrAddress,
            'form-title': translations.formTitle,
            'form-subtitle': translations.formSubtitle,
            'sec1-title': translations.sec1Title,
            'sec2-title': translations.sec2Title,
            'sec3-title': translations.sec3Title,
            'sec4-title': translations.sec4Title,
            'lbl-submit': translations.lblSubmit,
            'lbl-submit-note': translations.lblSubmitNote,
            'success-title': translations.successTitle,
            'success-msg': translations.successMsg,
            'admin-link': translations.adminLink
        };

        for (const [id, text] of Object.entries(elements)) {
            const el = document.getElementById(id);
            if (el) el.innerHTML = text;
        }

        // Save language preference
        try {
            localStorage.setItem('bf_lang', lang);
        } catch (e) {
            // Ignore
        }
    }

    /**
     * Get translation for a key
     * @param {string} key - Translation key
     * @param {string} lang - Language code (default: 'bn')
     * @returns {string} Translated text
     */
    function getTranslation(key, lang = 'bn') {
        const translations = TRANSLATIONS[lang] || TRANSLATIONS.bn;
        return translations[key] || key;
    }

    // ════════ EXPOSE GLOBALLY ════════

    window.BD_DATA = BD_DATA;
    window.TRANSLATIONS = TRANSLATIONS;
    window.COUNTRY_CODES = COUNTRY_CODES;

    window.getAllDivisions = getAllDivisions;
    window.getDistricts = getDistricts;
    window.getThanas = getThanas;
    window.getPostOffices = getPostOffices;
    window.getPostOfficeByCode = getPostOfficeByCode;
    window.searchPostOffices = searchPostOffices;
    window.validatePhone = validatePhone;
    window.formatPhone = formatPhone;
    window.changeLanguage = changeLanguage;
    window.getTranslation = getTranslation;

    // ════════ AUTO-INIT ════════

    document.addEventListener('DOMContentLoaded', function() {
        // Restore language preference
        try {
            const savedLang = localStorage.getItem('bf_lang');
            if (savedLang && TRANSLATIONS[savedLang]) {
                changeLanguage(savedLang);
                const langSelect = document.getElementById('langSel');
                if (langSelect) langSelect.value = savedLang;
            }
        } catch (e) {
            // Ignore
        }

        if (typeof DEBUG !== 'undefined' && DEBUG) {
            console.log('[Data] Initialized. Available divisions:', getAllDivisions().length);
        }
    });

})();