/**
 * ML Engine: Custom Machine Learning Algorithms for SplitSmart
 */

// 1. Linear Regression for Predictive Spending
export function predictNextMonth(data: { monthIndex: number; amount: number }[]): number {
  if (data.length < 2) return data.length === 1 ? data[0].amount : 0;

  const n = data.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const point of data) {
    sumX += point.monthIndex;
    sumY += point.amount;
    sumXY += point.monthIndex * point.amount;
    sumX2 += point.monthIndex * point.monthIndex;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return sumY / n; // fallback to average

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Predict for next month (n)
  const nextMonthIndex = data[data.length - 1].monthIndex + 1;
  const prediction = slope * nextMonthIndex + intercept;

  return Math.max(0, prediction); // Floor at 0
}

// 2. Statistical Z-Score Outlier Detection
export function calculateZScoreOutlier(value: number, historicalData: number[]): { isOutlier: boolean; zScore: number } {
  if (historicalData.length < 3) return { isOutlier: false, zScore: 0 };

  const mean = historicalData.reduce((a, b) => a + b, 0) / historicalData.length;
  const variance = historicalData.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / historicalData.length;
  const standardDeviation = Math.sqrt(variance);

  if (standardDeviation === 0) return { isOutlier: false, zScore: 0 };

  const zScore = Math.abs((value - mean) / standardDeviation);
  
  // Flag as outlier if it's more than 2.5 standard deviations away from the mean
  return { isOutlier: zScore > 2.5, zScore };
}

// 3. Naive Bayes Smart Categorization (Heuristic Mock)
// In a real NLP scenario, this would be trained on thousands of rows.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Dining": ["dinner", "lunch", "breakfast", "restaurant", "food", "dominos", "pizza", "burger", "cafe", "swiggy", "zomato"],
  "Groceries": ["grocery", "supermarket", "milk", "vegetables", "fruits", "mart", "bazaar", "store"],
  "Travel": ["uber", "ola", "flight", "train", "bus", "taxi", "cab", "petrol", "gas", "ticket"],
  "Utilities": ["electricity", "water", "internet", "wifi", "bill", "recharge", "phone"],
  "Entertainment": ["movie", "cinema", "netflix", "prime", "game", "concert", "show"],
  "Rent": ["rent", "deposit", "lease", "maintenance"],
};

export function naiveBayesCategorize(description: string): { category: string; confidence: number } {
  const words = description.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/);
  
  const scores: Record<string, number> = {};
  for (const category of Object.keys(CATEGORY_KEYWORDS)) {
    scores[category] = 0;
  }

  let maxScore = 0;
  let bestCategory = "Other";

  for (const word of words) {
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.includes(word)) {
        scores[category] += 1;
        if (scores[category] > maxScore) {
          maxScore = scores[category];
          bestCategory = category;
        }
      }
    }
  }

  // Calculate a mock confidence score based on matches
  const confidence = maxScore > 0 ? Math.min(0.95, 0.4 + (maxScore * 0.15)) : 0.1;

  return { category: bestCategory, confidence };
}
