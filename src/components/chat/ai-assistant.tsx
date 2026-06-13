"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Bot, X, Check, Loader2 } from "lucide-react";
import { parseExpenseIntent } from "@/lib/nlp-engine";
import { formatCurrency } from "@/lib/utils";

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string; parsed?: any }[]>([
    { role: "ai", content: "Hi! I'm your SplitSmart ML Assistant. Tell me about an expense in plain english. \n\nTry: 'Raj paid ₹1500 for Dominos and Aisha and Priya share it.'" }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsTyping(true);

    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Run custom NLP engine
    const parsed = parseExpenseIntent(userMessage);
    
    let aiResponse = "I couldn't quite understand the amount or payer. Could you rephrase?";
    if (parsed.amount && parsed.payer) {
      aiResponse = `I parsed your expense using ML! \n**Amount**: ${formatCurrency(parsed.amount)}\n**Payer**: ${parsed.payer}\n**Category**: ${parsed.category} (Confidence: ${(parsed.confidence * 100).toFixed(0)}%)\n**Split Between**: ${parsed.participants.length > 0 ? parsed.participants.join(", ") : "Everyone"}\n\nWould you like me to draft this expense?`;
    }

    setMessages(prev => [...prev, { role: "ai", content: aiResponse, parsed: parsed.amount && parsed.payer ? parsed : undefined }]);
    setIsTyping(false);
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-[0_0_20px_rgba(212,175,55,0.3)] bg-gradient-to-br from-primary via-primary/90 to-primary/80 hover:scale-110 hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all z-50 p-0 border border-white/20"
      >
        <Sparkles className="h-6 w-6 text-primary-foreground fill-primary-foreground/20" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <Card className="w-80 md:w-96 h-[500px] flex flex-col premium-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-14 border-b border-border/40 bg-card/40 backdrop-blur-md flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary/20 p-1.5 rounded-lg border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-sm tracking-wide">SplitSmart AI</span>
            <span className="bg-primary/10 border border-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest font-bold ml-1">Beta</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/5" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card/50 border border-border/40 rounded-tl-sm backdrop-blur-sm"}`}>
                {msg.role === "ai" && <Sparkles className="h-3 w-3 mb-1.5 text-primary" />}
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                
                {/* Draft Button for parsed intents */}
                {msg.parsed && (
                  <Button size="sm" className="w-full mt-4 btn-premium bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-medium border border-primary/20 shadow-md">
                    <Check className="h-4 w-4 mr-1.5" />
                    Draft Expense
                  </Button>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-muted/50 border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Parsing intent...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-border/40 bg-card/60 backdrop-blur-md">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2 relative">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your expense..." 
              className="rounded-full bg-background/50 border-border/50 pr-10 focus-visible:ring-primary/50"
            />
            <Button type="submit" size="icon" className="absolute right-1 h-8 w-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-transform hover:scale-105">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
