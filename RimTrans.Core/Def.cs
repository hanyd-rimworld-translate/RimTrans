﻿using System;
using System.Collections.Generic;
using System.Text;
using System.Xml.Linq;

namespace RimTrans.Core {
    /// <summary>
    /// Store
    /// </summary>
    public class Def {
        /// <summary>
        /// The path to the document of the def
        /// </summary>
        public readonly string filename;

        /// <summary>
        /// The xml element defined the def in the document.
        /// </summary>
        public readonly XElement element;

        /// <summary>
        /// The valid comment content before the element.
        /// </summary>
        public readonly string comment;

        /// <summary>
        /// The type of the def, such as 'ThingDef', 'PawnKindDef'....
        /// </summary>
        public readonly string defType;

        /// <summary>
        /// The name (ID) of the def
        /// </summary>
        public readonly string defName;

        /// <summary>
        /// The name of the def, used to inherit.
        /// </summary>
        public readonly string name;

        /// <summary>
        /// The name of the base def, used to inherit.
        /// </summary>
        public readonly string parentName;

        /// <summary>
        /// If the def is abstract or not. A abstract Def means that it won't be instantiated in the game.
        /// </summary>
        public readonly bool isAbstract;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="filename">The path to the document of the def</param>
        /// <param name="element">The xml element defined the def in the document.</param>
        /// <param name="comment">The xml comment before the element.</param>
        public Def(string filename, XElement element, XComment comment = null) {
            this.filename = filename;
            this.element = element;
            this.defType = element.Name.ToString();
            this.defName = element.Element("defName")?.Value;
            this.name = element.Attribute("Name")?.Value;
            this.parentName = element.Attribute("ParentName")?.Value;
            this.isAbstract = element.Attribute("Abstract")?.Value == "True";
            
            // process comment
            if (comment != null)
            {
                // All punctuation mark by in ASCII English part:
                // !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~
                // use some of these marks and whitespace
                var content = comment.Value.Trim(new char[] { '#', '$', '%', '&', '*', '+', '-', '/', '=', '@', '\\', '^', '_', '|', '~', '\t', '\n', '\v', '\f', '\r', ' ' });
                if (content.Length > 0 && !content.Contains("\n") && !content.Contains("\r")) {
                    this.comment = content;
                }
            }
        }
    }
}
