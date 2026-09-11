const fs = require('fs');

let content = fs.readFileSync('/Users/gauravkumarnayak/Desktop/Codesage-main/frontend/src/app/repos/page.tsx', 'utf8');

// Add Framer motion imports
content = content.replace("import { useState, useEffect, useRef } from \"react\";", "import { useState, useEffect, useRef } from \"react\";\nimport { motion, AnimatePresence } from \"framer-motion\";");

// Animate the repos list
content = content.replace(
  "<div className=\"space-y-2\">",
  "<div className=\"space-y-2\">\n<AnimatePresence>"
);
content = content.replace(
  "</div>\n        </div>\n\n        {/* Chat panel */}",
  "</AnimatePresence>\n</div>\n        </div>\n\n        {/* Chat panel */}"
);

// Add motion.div to repo mapping
content = content.replace(
  "key={repo.id}",
  "key={repo.id}\ninitial={{ opacity: 0, x: -20 }}\nanimate={{ opacity: 1, x: 0 }}\nexit={{ opacity: 0, scale: 0.9 }}\nlayout"
);
content = content.replace(
  /<div\n\s*key={repo\.id}/g,
  "<motion.div"
);
content = content.replace(
  /onClick={\(\) => setDeleteConfirm\(repo\.id\)}\s*>\s*<Trash2 className="h-3\.5 w-3\.5" \/>\s*<\/button>\s*<\/div>\s*<\/div>/g,
  "onClick={() => setDeleteConfirm(repo.id)}>\n<Trash2 className=\"h-3.5 w-3.5\" />\n</button>\n</div>\n</motion.div>"
);

fs.writeFileSync('/Users/gauravkumarnayak/Desktop/Codesage-main/frontend/src/app/repos/page.tsx', content);
