export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      auditoria: {
        Row: {
          acao: string;
          ator_id: string | null;
          contexto: Json | null;
          created_at: string;
          dados_anteriores: Json | null;
          dados_novos: Json | null;
          empresa_id: string | null;
          entidade_id: string | null;
          entidade_tipo: string;
          id: number;
          request_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          acao: string;
          ator_id?: string | null;
          contexto?: Json | null;
          created_at?: string;
          dados_anteriores?: Json | null;
          dados_novos?: Json | null;
          empresa_id?: string | null;
          entidade_id?: string | null;
          entidade_tipo: string;
          id?: never;
          request_id?: string | null;
        };
        Update: {
          acao?: string;
          ator_id?: string | null;
          contexto?: Json | null;
          created_at?: string;
          dados_anteriores?: Json | null;
          dados_novos?: Json | null;
          empresa_id?: string | null;
          entidade_id?: string | null;
          entidade_tipo?: string;
          id?: never;
          request_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "auditoria_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      bens: {
        Row: {
          codigo: string;
          created_at: string;
          created_by: string | null;
          empresa_id: string;
          id: string;
          identificacao_fornecedor: string | null;
          item_locacao_id: string;
          local_atual_id: string | null;
          numero_serie: string | null;
          observacoes: string | null;
          placa: string | null;
          recebimento_id: string | null;
          responsavel_atual_id: string | null;
          status: Database["public"]["Enums"]["status_bem"];
          substitui_bem_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          codigo: string;
          created_at?: string;
          created_by?: string | null;
          empresa_id: string;
          id?: string;
          identificacao_fornecedor?: string | null;
          item_locacao_id: string;
          local_atual_id?: string | null;
          numero_serie?: string | null;
          observacoes?: string | null;
          placa?: string | null;
          recebimento_id?: string | null;
          responsavel_atual_id?: string | null;
          status?: Database["public"]["Enums"]["status_bem"];
          substitui_bem_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          codigo?: string;
          created_at?: string;
          created_by?: string | null;
          empresa_id?: string;
          id?: string;
          identificacao_fornecedor?: string | null;
          item_locacao_id?: string;
          local_atual_id?: string | null;
          numero_serie?: string | null;
          observacoes?: string | null;
          placa?: string | null;
          recebimento_id?: string | null;
          responsavel_atual_id?: string | null;
          status?: Database["public"]["Enums"]["status_bem"];
          substitui_bem_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bens_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bens_empresa_id_item_locacao_id_fkey";
            columns: ["empresa_id", "item_locacao_id"];
            isOneToOne: false;
            referencedRelation: "itens_locacao";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "bens_empresa_id_item_locacao_id_fkey";
            columns: ["empresa_id", "item_locacao_id"];
            isOneToOne: false;
            referencedRelation: "v_saldo_item_locacao";
            referencedColumns: ["empresa_id", "item_locacao_id"];
          },
          {
            foreignKeyName: "bens_empresa_id_local_atual_id_fkey";
            columns: ["empresa_id", "local_atual_id"];
            isOneToOne: false;
            referencedRelation: "locais";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "bens_empresa_id_recebimento_id_fkey";
            columns: ["empresa_id", "recebimento_id"];
            isOneToOne: false;
            referencedRelation: "recebimentos";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "bens_empresa_id_responsavel_atual_id_fkey";
            columns: ["empresa_id", "responsavel_atual_id"];
            isOneToOne: false;
            referencedRelation: "usuarios_empresa";
            referencedColumns: ["empresa_id", "user_id"];
          },
          {
            foreignKeyName: "bens_empresa_id_substitui_bem_id_fkey";
            columns: ["empresa_id", "substitui_bem_id"];
            isOneToOne: false;
            referencedRelation: "bens";
            referencedColumns: ["empresa_id", "id"];
          },
        ];
      };
      categorias_bem: {
        Row: {
          ativo: boolean;
          checklist_familia_id: string | null;
          created_at: string;
          created_by: string | null;
          empresa_id: string;
          exige_ident_fornecedor: boolean;
          exige_numero_serie: boolean;
          exige_placa: boolean;
          exige_vistoria_saida: boolean;
          id: string;
          modo_controle: Database["public"]["Enums"]["modo_controle"];
          nome: string;
          unidade_padrao: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          checklist_familia_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          empresa_id: string;
          exige_ident_fornecedor?: boolean;
          exige_numero_serie?: boolean;
          exige_placa?: boolean;
          exige_vistoria_saida?: boolean;
          id?: string;
          modo_controle: Database["public"]["Enums"]["modo_controle"];
          nome: string;
          unidade_padrao?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          ativo?: boolean;
          checklist_familia_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          empresa_id?: string;
          exige_ident_fornecedor?: boolean;
          exige_numero_serie?: boolean;
          exige_placa?: boolean;
          exige_vistoria_saida?: boolean;
          id?: string;
          modo_controle?: Database["public"]["Enums"]["modo_controle"];
          nome?: string;
          unidade_padrao?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "categorias_bem_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      centros_custo: {
        Row: {
          ativo: boolean;
          codigo: string;
          created_at: string;
          created_by: string | null;
          empresa_id: string;
          id: string;
          nome: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          codigo: string;
          created_at?: string;
          created_by?: string | null;
          empresa_id: string;
          id?: string;
          nome: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          ativo?: boolean;
          codigo?: string;
          created_at?: string;
          created_by?: string | null;
          empresa_id?: string;
          id?: string;
          nome?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "centros_custo_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      cobrancas: {
        Row: {
          codigo: string;
          competencia_fim: string;
          competencia_inicio: string;
          conferida_em: string | null;
          conferida_por: string | null;
          created_at: string;
          created_by: string | null;
          divergente_em: string | null;
          divergente_por: string | null;
          empresa_id: string;
          id: string;
          locacao_id: string;
          motivo_divergencia: string | null;
          numero_documento: string | null;
          observacoes: string | null;
          resolucao: string | null;
          resolvida_em: string | null;
          resolvida_por: string | null;
          status: Database["public"]["Enums"]["status_cobranca"];
          updated_at: string;
          updated_by: string | null;
          valor_cobrado: number;
        };
        ComputedFields: never;
        Insert: {
          codigo: string;
          competencia_fim: string;
          competencia_inicio: string;
          conferida_em?: string | null;
          conferida_por?: string | null;
          created_at?: string;
          created_by?: string | null;
          divergente_em?: string | null;
          divergente_por?: string | null;
          empresa_id: string;
          id?: string;
          locacao_id: string;
          motivo_divergencia?: string | null;
          numero_documento?: string | null;
          observacoes?: string | null;
          resolucao?: string | null;
          resolvida_em?: string | null;
          resolvida_por?: string | null;
          status?: Database["public"]["Enums"]["status_cobranca"];
          updated_at?: string;
          updated_by?: string | null;
          valor_cobrado: number;
        };
        Update: {
          codigo?: string;
          competencia_fim?: string;
          competencia_inicio?: string;
          conferida_em?: string | null;
          conferida_por?: string | null;
          created_at?: string;
          created_by?: string | null;
          divergente_em?: string | null;
          divergente_por?: string | null;
          empresa_id?: string;
          id?: string;
          locacao_id?: string;
          motivo_divergencia?: string | null;
          numero_documento?: string | null;
          observacoes?: string | null;
          resolucao?: string | null;
          resolvida_em?: string | null;
          resolvida_por?: string | null;
          status?: Database["public"]["Enums"]["status_cobranca"];
          updated_at?: string;
          updated_by?: string | null;
          valor_cobrado?: number;
        };
        Relationships: [
          {
            foreignKeyName: "cobrancas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cobrancas_empresa_id_locacao_id_fkey";
            columns: ["empresa_id", "locacao_id"];
            isOneToOne: false;
            referencedRelation: "locacoes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "cobrancas_empresa_id_locacao_id_fkey";
            columns: ["empresa_id", "locacao_id"];
            isOneToOne: false;
            referencedRelation: "v_saldo_locacao";
            referencedColumns: ["empresa_id", "locacao_id"];
          },
        ];
      };
      devolucoes: {
        Row: {
          agendada_em: string | null;
          agendada_para: string | null;
          agendada_por: string | null;
          cancelada_em: string | null;
          cancelada_por: string | null;
          ciencia_financeira_em: string | null;
          ciencia_financeira_por: string | null;
          codigo: string;
          comprovante_confirmado: boolean;
          conferida_em: string | null;
          conferida_por: string | null;
          created_at: string;
          created_by: string | null;
          empresa_id: string;
          fornecedor_recebedor: string | null;
          id: string;
          locacao_id: string;
          motivo_cancelamento: string | null;
          observacoes: string | null;
          retirada_confirmada_em: string | null;
          retirada_confirmada_por: string | null;
          retirada_em: string | null;
          solicitada_em: string | null;
          solicitada_por: string | null;
          status: Database["public"]["Enums"]["status_devolucao"];
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          agendada_em?: string | null;
          agendada_para?: string | null;
          agendada_por?: string | null;
          cancelada_em?: string | null;
          cancelada_por?: string | null;
          ciencia_financeira_em?: string | null;
          ciencia_financeira_por?: string | null;
          codigo: string;
          comprovante_confirmado?: boolean;
          conferida_em?: string | null;
          conferida_por?: string | null;
          created_at?: string;
          created_by?: string | null;
          empresa_id: string;
          fornecedor_recebedor?: string | null;
          id?: string;
          locacao_id: string;
          motivo_cancelamento?: string | null;
          observacoes?: string | null;
          retirada_confirmada_em?: string | null;
          retirada_confirmada_por?: string | null;
          retirada_em?: string | null;
          solicitada_em?: string | null;
          solicitada_por?: string | null;
          status?: Database["public"]["Enums"]["status_devolucao"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          agendada_em?: string | null;
          agendada_para?: string | null;
          agendada_por?: string | null;
          cancelada_em?: string | null;
          cancelada_por?: string | null;
          ciencia_financeira_em?: string | null;
          ciencia_financeira_por?: string | null;
          codigo?: string;
          comprovante_confirmado?: boolean;
          conferida_em?: string | null;
          conferida_por?: string | null;
          created_at?: string;
          created_by?: string | null;
          empresa_id?: string;
          fornecedor_recebedor?: string | null;
          id?: string;
          locacao_id?: string;
          motivo_cancelamento?: string | null;
          observacoes?: string | null;
          retirada_confirmada_em?: string | null;
          retirada_confirmada_por?: string | null;
          retirada_em?: string | null;
          solicitada_em?: string | null;
          solicitada_por?: string | null;
          status?: Database["public"]["Enums"]["status_devolucao"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "devolucoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "devolucoes_empresa_id_locacao_id_fkey";
            columns: ["empresa_id", "locacao_id"];
            isOneToOne: false;
            referencedRelation: "locacoes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "devolucoes_empresa_id_locacao_id_fkey";
            columns: ["empresa_id", "locacao_id"];
            isOneToOne: false;
            referencedRelation: "v_saldo_locacao";
            referencedColumns: ["empresa_id", "locacao_id"];
          },
        ];
      };
      empresas: {
        Row: {
          ativo: boolean;
          created_at: string;
          created_by: string | null;
          demonstracao: boolean;
          documento: string | null;
          exige_aceite_movimentacao: boolean;
          id: string;
          limite_atraso_horas: number;
          limite_upload_imagem_mb: number;
          limite_upload_pdf_mb: number;
          nome: string;
          timezone: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          created_at?: string;
          created_by?: string | null;
          demonstracao?: boolean;
          documento?: string | null;
          exige_aceite_movimentacao?: boolean;
          id?: string;
          limite_atraso_horas?: number;
          limite_upload_imagem_mb?: number;
          limite_upload_pdf_mb?: number;
          nome: string;
          timezone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          created_by?: string | null;
          demonstracao?: boolean;
          documento?: string | null;
          exige_aceite_movimentacao?: boolean;
          id?: string;
          limite_atraso_horas?: number;
          limite_upload_imagem_mb?: number;
          limite_upload_pdf_mb?: number;
          nome?: string;
          timezone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      evidencias: {
        Row: {
          bucket: string;
          capturada_em: string | null;
          created_at: string;
          created_by: string | null;
          empresa_id: string;
          entidade_id: string;
          entidade_tipo: Database["public"]["Enums"]["entidade_evidencia"];
          enviada_em: string;
          enviada_por: string;
          hash_arquivo: string;
          id: string;
          latitude: number | null;
          legenda: string | null;
          longitude: number | null;
          mime_type: string;
          motivo_remocao: string | null;
          nome_original: string | null;
          pergunta_id: string | null;
          removida_em: string | null;
          removida_por: string | null;
          status: Database["public"]["Enums"]["status_evidencia"];
          storage_path: string;
          substituida_por_id: string | null;
          tamanho_bytes: number;
          tipo: Database["public"]["Enums"]["tipo_evidencia"];
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          bucket: string;
          capturada_em?: string | null;
          created_at?: string;
          created_by?: string | null;
          empresa_id: string;
          entidade_id: string;
          entidade_tipo: Database["public"]["Enums"]["entidade_evidencia"];
          enviada_em?: string;
          enviada_por?: string;
          hash_arquivo: string;
          id?: string;
          latitude?: number | null;
          legenda?: string | null;
          longitude?: number | null;
          mime_type: string;
          motivo_remocao?: string | null;
          nome_original?: string | null;
          pergunta_id?: string | null;
          removida_em?: string | null;
          removida_por?: string | null;
          status?: Database["public"]["Enums"]["status_evidencia"];
          storage_path: string;
          substituida_por_id?: string | null;
          tamanho_bytes: number;
          tipo: Database["public"]["Enums"]["tipo_evidencia"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          bucket?: string;
          capturada_em?: string | null;
          created_at?: string;
          created_by?: string | null;
          empresa_id?: string;
          entidade_id?: string;
          entidade_tipo?: Database["public"]["Enums"]["entidade_evidencia"];
          enviada_em?: string;
          enviada_por?: string;
          hash_arquivo?: string;
          id?: string;
          latitude?: number | null;
          legenda?: string | null;
          longitude?: number | null;
          mime_type?: string;
          motivo_remocao?: string | null;
          nome_original?: string | null;
          pergunta_id?: string | null;
          removida_em?: string | null;
          removida_por?: string | null;
          status?: Database["public"]["Enums"]["status_evidencia"];
          storage_path?: string;
          substituida_por_id?: string | null;
          tamanho_bytes?: number;
          tipo?: Database["public"]["Enums"]["tipo_evidencia"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "evidencias_empresa_id_enviada_por_fkey";
            columns: ["empresa_id", "enviada_por"];
            isOneToOne: false;
            referencedRelation: "usuarios_empresa";
            referencedColumns: ["empresa_id", "user_id"];
          },
          {
            foreignKeyName: "evidencias_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidencias_empresa_id_pergunta_id_fkey";
            columns: ["empresa_id", "pergunta_id"];
            isOneToOne: false;
            referencedRelation: "perguntas_checklist";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "evidencias_empresa_id_substituida_por_id_fkey";
            columns: ["empresa_id", "substituida_por_id"];
            isOneToOne: false;
            referencedRelation: "evidencias";
            referencedColumns: ["empresa_id", "id"];
          },
        ];
      };
      fornecedores: {
        Row: {
          ativo: boolean;
          contato: NonNullable<Json>;
          created_at: string;
          created_by: string | null;
          documento: string | null;
          empresa_id: string;
          id: string;
          nome_fantasia: string | null;
          observacoes: string | null;
          razao_social: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          contato?: NonNullable<Json>;
          created_at?: string;
          created_by?: string | null;
          documento?: string | null;
          empresa_id: string;
          id?: string;
          nome_fantasia?: string | null;
          observacoes?: string | null;
          razao_social: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          ativo?: boolean;
          contato?: NonNullable<Json>;
          created_at?: string;
          created_by?: string | null;
          documento?: string | null;
          empresa_id?: string;
          id?: string;
          nome_fantasia?: string | null;
          observacoes?: string | null;
          razao_social?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fornecedores_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      itens_devolucao: {
        Row: {
          ativo: boolean;
          bem_id: string | null;
          condicao_saida: Database["public"]["Enums"]["condicao_item"] | null;
          created_at: string;
          created_by: string | null;
          devolucao_id: string;
          empresa_id: string;
          id: string;
          item_locacao_id: string;
          lote_id: string | null;
          observacao: string | null;
          quantidade_retirada: number | null;
          quantidade_solicitada: number;
          status_anterior_bem: Database["public"]["Enums"]["status_bem"] | null;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          bem_id?: string | null;
          condicao_saida?: Database["public"]["Enums"]["condicao_item"] | null;
          created_at?: string;
          created_by?: string | null;
          devolucao_id: string;
          empresa_id: string;
          id?: string;
          item_locacao_id: string;
          lote_id?: string | null;
          observacao?: string | null;
          quantidade_retirada?: number | null;
          quantidade_solicitada: number;
          status_anterior_bem?: Database["public"]["Enums"]["status_bem"] | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          ativo?: boolean;
          bem_id?: string | null;
          condicao_saida?: Database["public"]["Enums"]["condicao_item"] | null;
          created_at?: string;
          created_by?: string | null;
          devolucao_id?: string;
          empresa_id?: string;
          id?: string;
          item_locacao_id?: string;
          lote_id?: string | null;
          observacao?: string | null;
          quantidade_retirada?: number | null;
          quantidade_solicitada?: number;
          status_anterior_bem?: Database["public"]["Enums"]["status_bem"] | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "itens_devolucao_empresa_id_bem_id_fkey";
            columns: ["empresa_id", "bem_id"];
            isOneToOne: false;
            referencedRelation: "bens";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "itens_devolucao_empresa_id_devolucao_id_fkey";
            columns: ["empresa_id", "devolucao_id"];
            isOneToOne: false;
            referencedRelation: "devolucoes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "itens_devolucao_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "itens_devolucao_empresa_id_item_locacao_id_fkey";
            columns: ["empresa_id", "item_locacao_id"];
            isOneToOne: false;
            referencedRelation: "itens_locacao";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "itens_devolucao_empresa_id_item_locacao_id_fkey";
            columns: ["empresa_id", "item_locacao_id"];
            isOneToOne: false;
            referencedRelation: "v_saldo_item_locacao";
            referencedColumns: ["empresa_id", "item_locacao_id"];
          },
          {
            foreignKeyName: "itens_devolucao_empresa_id_lote_id_fkey";
            columns: ["empresa_id", "lote_id"];
            isOneToOne: false;
            referencedRelation: "lotes";
            referencedColumns: ["empresa_id", "id"];
          },
        ];
      };
      itens_locacao: {
        Row: {
          categoria_id: string;
          created_at: string;
          created_by: string | null;
          descricao: string;
          empresa_id: string;
          id: string;
          locacao_id: string;
          modo_controle: Database["public"]["Enums"]["modo_controle"];
          observacao: string | null;
          periodicidade: Database["public"]["Enums"]["periodicidade"];
          quantidade_contratada: number;
          unidade: string;
          updated_at: string;
          updated_by: string | null;
          valor_unitario: number;
        };
        ComputedFields: never;
        Insert: {
          categoria_id: string;
          created_at?: string;
          created_by?: string | null;
          descricao: string;
          empresa_id: string;
          id?: string;
          locacao_id: string;
          modo_controle: Database["public"]["Enums"]["modo_controle"];
          observacao?: string | null;
          periodicidade: Database["public"]["Enums"]["periodicidade"];
          quantidade_contratada: number;
          unidade?: string;
          updated_at?: string;
          updated_by?: string | null;
          valor_unitario: number;
        };
        Update: {
          categoria_id?: string;
          created_at?: string;
          created_by?: string | null;
          descricao?: string;
          empresa_id?: string;
          id?: string;
          locacao_id?: string;
          modo_controle?: Database["public"]["Enums"]["modo_controle"];
          observacao?: string | null;
          periodicidade?: Database["public"]["Enums"]["periodicidade"];
          quantidade_contratada?: number;
          unidade?: string;
          updated_at?: string;
          updated_by?: string | null;
          valor_unitario?: number;
        };
        Relationships: [
          {
            foreignKeyName: "itens_locacao_empresa_id_categoria_id_fkey";
            columns: ["empresa_id", "categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias_bem";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "itens_locacao_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "itens_locacao_empresa_id_locacao_id_fkey";
            columns: ["empresa_id", "locacao_id"];
            isOneToOne: false;
            referencedRelation: "locacoes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "itens_locacao_empresa_id_locacao_id_fkey";
            columns: ["empresa_id", "locacao_id"];
            isOneToOne: false;
            referencedRelation: "v_saldo_locacao";
            referencedColumns: ["empresa_id", "locacao_id"];
          },
        ];
      };
      itens_recebimento: {
        Row: {
          bem_id: string | null;
          condicao: Database["public"]["Enums"]["condicao_item"];
          created_at: string;
          created_by: string | null;
          empresa_id: string;
          id: string;
          item_locacao_id: string;
          lote_id: string | null;
          observacao: string | null;
          quantidade: number;
          recebimento_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          bem_id?: string | null;
          condicao?: Database["public"]["Enums"]["condicao_item"];
          created_at?: string;
          created_by?: string | null;
          empresa_id: string;
          id?: string;
          item_locacao_id: string;
          lote_id?: string | null;
          observacao?: string | null;
          quantidade: number;
          recebimento_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          bem_id?: string | null;
          condicao?: Database["public"]["Enums"]["condicao_item"];
          created_at?: string;
          created_by?: string | null;
          empresa_id?: string;
          id?: string;
          item_locacao_id?: string;
          lote_id?: string | null;
          observacao?: string | null;
          quantidade?: number;
          recebimento_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "itens_recebimento_empresa_id_bem_id_fkey";
            columns: ["empresa_id", "bem_id"];
            isOneToOne: false;
            referencedRelation: "bens";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "itens_recebimento_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "itens_recebimento_empresa_id_item_locacao_id_fkey";
            columns: ["empresa_id", "item_locacao_id"];
            isOneToOne: false;
            referencedRelation: "itens_locacao";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "itens_recebimento_empresa_id_item_locacao_id_fkey";
            columns: ["empresa_id", "item_locacao_id"];
            isOneToOne: false;
            referencedRelation: "v_saldo_item_locacao";
            referencedColumns: ["empresa_id", "item_locacao_id"];
          },
          {
            foreignKeyName: "itens_recebimento_empresa_id_lote_id_fkey";
            columns: ["empresa_id", "lote_id"];
            isOneToOne: false;
            referencedRelation: "lotes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "itens_recebimento_empresa_id_recebimento_id_fkey";
            columns: ["empresa_id", "recebimento_id"];
            isOneToOne: false;
            referencedRelation: "recebimentos";
            referencedColumns: ["empresa_id", "id"];
          },
        ];
      };
      locacoes: {
        Row: {
          ativada_em: string | null;
          ativada_por: string | null;
          cancelada_em: string | null;
          cancelada_por: string | null;
          centro_custo_id: string | null;
          codigo: string;
          created_at: string;
          created_by: string | null;
          data_encerramento_financeiro: string | null;
          desmobilizacao_iniciada_em: string | null;
          desmobilizacao_iniciada_por: string | null;
          empresa_id: string;
          encerrada_financeiro_em: string | null;
          encerrada_financeiro_por: string | null;
          encerrada_operacional_em: string | null;
          encerrada_operacional_por: string | null;
          fornecedor_id: string | null;
          id: string;
          inicio_efetivo: string | null;
          inicio_previsto: string | null;
          motivo_cancelamento: string | null;
          observacoes: string | null;
          status: Database["public"]["Enums"]["status_locacao"];
          status_financeiro: Database["public"]["Enums"]["status_financeiro"];
          termino_previsto: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          ativada_em?: string | null;
          ativada_por?: string | null;
          cancelada_em?: string | null;
          cancelada_por?: string | null;
          centro_custo_id?: string | null;
          codigo: string;
          created_at?: string;
          created_by?: string | null;
          data_encerramento_financeiro?: string | null;
          desmobilizacao_iniciada_em?: string | null;
          desmobilizacao_iniciada_por?: string | null;
          empresa_id: string;
          encerrada_financeiro_em?: string | null;
          encerrada_financeiro_por?: string | null;
          encerrada_operacional_em?: string | null;
          encerrada_operacional_por?: string | null;
          fornecedor_id?: string | null;
          id?: string;
          inicio_efetivo?: string | null;
          inicio_previsto?: string | null;
          motivo_cancelamento?: string | null;
          observacoes?: string | null;
          status?: Database["public"]["Enums"]["status_locacao"];
          status_financeiro?: Database["public"]["Enums"]["status_financeiro"];
          termino_previsto?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          ativada_em?: string | null;
          ativada_por?: string | null;
          cancelada_em?: string | null;
          cancelada_por?: string | null;
          centro_custo_id?: string | null;
          codigo?: string;
          created_at?: string;
          created_by?: string | null;
          data_encerramento_financeiro?: string | null;
          desmobilizacao_iniciada_em?: string | null;
          desmobilizacao_iniciada_por?: string | null;
          empresa_id?: string;
          encerrada_financeiro_em?: string | null;
          encerrada_financeiro_por?: string | null;
          encerrada_operacional_em?: string | null;
          encerrada_operacional_por?: string | null;
          fornecedor_id?: string | null;
          id?: string;
          inicio_efetivo?: string | null;
          inicio_previsto?: string | null;
          motivo_cancelamento?: string | null;
          observacoes?: string | null;
          status?: Database["public"]["Enums"]["status_locacao"];
          status_financeiro?: Database["public"]["Enums"]["status_financeiro"];
          termino_previsto?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "locacoes_empresa_id_centro_custo_id_fkey";
            columns: ["empresa_id", "centro_custo_id"];
            isOneToOne: false;
            referencedRelation: "centros_custo";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "locacoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "locacoes_empresa_id_fornecedor_id_fkey";
            columns: ["empresa_id", "fornecedor_id"];
            isOneToOne: false;
            referencedRelation: "fornecedores";
            referencedColumns: ["empresa_id", "id"];
          },
        ];
      };
      locais: {
        Row: {
          ativo: boolean;
          codigo: string;
          created_at: string;
          created_by: string | null;
          empresa_id: string;
          endereco: string | null;
          id: string;
          nome: string;
          tipo: Database["public"]["Enums"]["tipo_local"];
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          codigo: string;
          created_at?: string;
          created_by?: string | null;
          empresa_id: string;
          endereco?: string | null;
          id?: string;
          nome: string;
          tipo?: Database["public"]["Enums"]["tipo_local"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          ativo?: boolean;
          codigo?: string;
          created_at?: string;
          created_by?: string | null;
          empresa_id?: string;
          endereco?: string | null;
          id?: string;
          nome?: string;
          tipo?: Database["public"]["Enums"]["tipo_local"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "locais_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      lotes: {
        Row: {
          codigo: string;
          created_at: string;
          created_by: string | null;
          empresa_id: string;
          id: string;
          item_locacao_id: string;
          local_atual_id: string;
          lote_origem_id: string | null;
          observacoes: string | null;
          quantidade_baixada: number;
          quantidade_devolvida: number;
          quantidade_dividida: number;
          quantidade_recebida: number;
          recebimento_id: string | null;
          responsavel_atual_id: string;
          saldo: number | null;
          status: Database["public"]["Enums"]["status_lote"];
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          codigo: string;
          created_at?: string;
          created_by?: string | null;
          empresa_id: string;
          id?: string;
          item_locacao_id: string;
          local_atual_id: string;
          lote_origem_id?: string | null;
          observacoes?: string | null;
          quantidade_baixada?: number;
          quantidade_devolvida?: number;
          quantidade_dividida?: number;
          quantidade_recebida: number;
          recebimento_id?: string | null;
          responsavel_atual_id: string;
          saldo?: never;
          status?: Database["public"]["Enums"]["status_lote"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          codigo?: string;
          created_at?: string;
          created_by?: string | null;
          empresa_id?: string;
          id?: string;
          item_locacao_id?: string;
          local_atual_id?: string;
          lote_origem_id?: string | null;
          observacoes?: string | null;
          quantidade_baixada?: number;
          quantidade_devolvida?: number;
          quantidade_dividida?: number;
          quantidade_recebida?: number;
          recebimento_id?: string | null;
          responsavel_atual_id?: string;
          saldo?: never;
          status?: Database["public"]["Enums"]["status_lote"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lotes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lotes_empresa_id_item_locacao_id_fkey";
            columns: ["empresa_id", "item_locacao_id"];
            isOneToOne: false;
            referencedRelation: "itens_locacao";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "lotes_empresa_id_item_locacao_id_fkey";
            columns: ["empresa_id", "item_locacao_id"];
            isOneToOne: false;
            referencedRelation: "v_saldo_item_locacao";
            referencedColumns: ["empresa_id", "item_locacao_id"];
          },
          {
            foreignKeyName: "lotes_empresa_id_local_atual_id_fkey";
            columns: ["empresa_id", "local_atual_id"];
            isOneToOne: false;
            referencedRelation: "locais";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "lotes_empresa_id_lote_origem_id_fkey";
            columns: ["empresa_id", "lote_origem_id"];
            isOneToOne: false;
            referencedRelation: "lotes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "lotes_empresa_id_recebimento_id_fkey";
            columns: ["empresa_id", "recebimento_id"];
            isOneToOne: false;
            referencedRelation: "recebimentos";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "lotes_empresa_id_responsavel_atual_id_fkey";
            columns: ["empresa_id", "responsavel_atual_id"];
            isOneToOne: false;
            referencedRelation: "usuarios_empresa";
            referencedColumns: ["empresa_id", "user_id"];
          },
        ];
      };
      modelos_checklist: {
        Row: {
          created_at: string;
          created_by: string | null;
          descricao: string | null;
          empresa_id: string;
          familia_id: string;
          id: string;
          nome: string;
          publicado_em: string | null;
          publicado_por: string | null;
          status: Database["public"]["Enums"]["status_checklist"];
          updated_at: string;
          updated_by: string | null;
          versao: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          descricao?: string | null;
          empresa_id: string;
          familia_id?: string;
          id?: string;
          nome: string;
          publicado_em?: string | null;
          publicado_por?: string | null;
          status?: Database["public"]["Enums"]["status_checklist"];
          updated_at?: string;
          updated_by?: string | null;
          versao?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          descricao?: string | null;
          empresa_id?: string;
          familia_id?: string;
          id?: string;
          nome?: string;
          publicado_em?: string | null;
          publicado_por?: string | null;
          status?: Database["public"]["Enums"]["status_checklist"];
          updated_at?: string;
          updated_by?: string | null;
          versao?: number;
        };
        Relationships: [
          {
            foreignKeyName: "modelos_checklist_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      movimentacoes: {
        Row: {
          aceita_por: string | null;
          aceite_administrativo: boolean;
          bem_id: string | null;
          cancelada_em: string | null;
          cancelada_por: string | null;
          codigo: string;
          confirmada_em: string | null;
          corrige_movimentacao_id: string | null;
          created_at: string;
          created_by: string | null;
          data_evento: string;
          destino_local_id: string;
          empresa_id: string;
          id: string;
          justificativa_aceite_administrativo: string | null;
          lote_destino_id: string | null;
          lote_id: string | null;
          motivo: string;
          motivo_recusa: string | null;
          novo_responsavel_id: string;
          origem_local_id: string;
          quantidade: number | null;
          recusada_em: string | null;
          recusada_por: string | null;
          responsavel_anterior_id: string;
          status: Database["public"]["Enums"]["status_movimentacao"];
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          aceita_por?: string | null;
          aceite_administrativo?: boolean;
          bem_id?: string | null;
          cancelada_em?: string | null;
          cancelada_por?: string | null;
          codigo: string;
          confirmada_em?: string | null;
          corrige_movimentacao_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_evento: string;
          destino_local_id: string;
          empresa_id: string;
          id?: string;
          justificativa_aceite_administrativo?: string | null;
          lote_destino_id?: string | null;
          lote_id?: string | null;
          motivo: string;
          motivo_recusa?: string | null;
          novo_responsavel_id: string;
          origem_local_id: string;
          quantidade?: number | null;
          recusada_em?: string | null;
          recusada_por?: string | null;
          responsavel_anterior_id: string;
          status: Database["public"]["Enums"]["status_movimentacao"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          aceita_por?: string | null;
          aceite_administrativo?: boolean;
          bem_id?: string | null;
          cancelada_em?: string | null;
          cancelada_por?: string | null;
          codigo?: string;
          confirmada_em?: string | null;
          corrige_movimentacao_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_evento?: string;
          destino_local_id?: string;
          empresa_id?: string;
          id?: string;
          justificativa_aceite_administrativo?: string | null;
          lote_destino_id?: string | null;
          lote_id?: string | null;
          motivo?: string;
          motivo_recusa?: string | null;
          novo_responsavel_id?: string;
          origem_local_id?: string;
          quantidade?: number | null;
          recusada_em?: string | null;
          recusada_por?: string | null;
          responsavel_anterior_id?: string;
          status?: Database["public"]["Enums"]["status_movimentacao"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "movimentacoes_empresa_id_bem_id_fkey";
            columns: ["empresa_id", "bem_id"];
            isOneToOne: false;
            referencedRelation: "bens";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "movimentacoes_empresa_id_corrige_movimentacao_id_fkey";
            columns: ["empresa_id", "corrige_movimentacao_id"];
            isOneToOne: false;
            referencedRelation: "movimentacoes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "movimentacoes_empresa_id_destino_local_id_fkey";
            columns: ["empresa_id", "destino_local_id"];
            isOneToOne: false;
            referencedRelation: "locais";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "movimentacoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimentacoes_empresa_id_lote_destino_id_fkey";
            columns: ["empresa_id", "lote_destino_id"];
            isOneToOne: false;
            referencedRelation: "lotes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "movimentacoes_empresa_id_lote_id_fkey";
            columns: ["empresa_id", "lote_id"];
            isOneToOne: false;
            referencedRelation: "lotes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "movimentacoes_empresa_id_novo_responsavel_id_fkey";
            columns: ["empresa_id", "novo_responsavel_id"];
            isOneToOne: false;
            referencedRelation: "usuarios_empresa";
            referencedColumns: ["empresa_id", "user_id"];
          },
          {
            foreignKeyName: "movimentacoes_empresa_id_origem_local_id_fkey";
            columns: ["empresa_id", "origem_local_id"];
            isOneToOne: false;
            referencedRelation: "locais";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "movimentacoes_empresa_id_responsavel_anterior_id_fkey";
            columns: ["empresa_id", "responsavel_anterior_id"];
            isOneToOne: false;
            referencedRelation: "usuarios_empresa";
            referencedColumns: ["empresa_id", "user_id"];
          },
        ];
      };
      ocorrencias: {
        Row: {
          bem_id: string | null;
          bem_substituto_id: string | null;
          cancelada_em: string | null;
          cancelada_por: string | null;
          codigo: string;
          created_at: string;
          created_by: string | null;
          data_evento: string;
          descricao: string;
          empresa_id: string;
          id: string;
          locacao_id: string;
          lote_id: string | null;
          motivo_cancelamento: string | null;
          motivo_reabertura: string | null;
          prazo: string | null;
          prioridade: Database["public"]["Enums"]["prioridade"];
          quantidade: number | null;
          reaberta_em: string | null;
          reaberta_por: string | null;
          recebimento_id: string | null;
          resolucao: string | null;
          resolvida_em: string | null;
          resolvida_por: string | null;
          responsavel_id: string | null;
          resultado: Database["public"]["Enums"]["resultado_ocorrencia"] | null;
          status: Database["public"]["Enums"]["status_ocorrencia"];
          status_anterior_bem: Database["public"]["Enums"]["status_bem"] | null;
          tipo: Database["public"]["Enums"]["tipo_ocorrencia"];
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          bem_id?: string | null;
          bem_substituto_id?: string | null;
          cancelada_em?: string | null;
          cancelada_por?: string | null;
          codigo: string;
          created_at?: string;
          created_by?: string | null;
          data_evento: string;
          descricao: string;
          empresa_id: string;
          id?: string;
          locacao_id: string;
          lote_id?: string | null;
          motivo_cancelamento?: string | null;
          motivo_reabertura?: string | null;
          prazo?: string | null;
          prioridade?: Database["public"]["Enums"]["prioridade"];
          quantidade?: number | null;
          reaberta_em?: string | null;
          reaberta_por?: string | null;
          recebimento_id?: string | null;
          resolucao?: string | null;
          resolvida_em?: string | null;
          resolvida_por?: string | null;
          responsavel_id?: string | null;
          resultado?: Database["public"]["Enums"]["resultado_ocorrencia"] | null;
          status?: Database["public"]["Enums"]["status_ocorrencia"];
          status_anterior_bem?: Database["public"]["Enums"]["status_bem"] | null;
          tipo: Database["public"]["Enums"]["tipo_ocorrencia"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          bem_id?: string | null;
          bem_substituto_id?: string | null;
          cancelada_em?: string | null;
          cancelada_por?: string | null;
          codigo?: string;
          created_at?: string;
          created_by?: string | null;
          data_evento?: string;
          descricao?: string;
          empresa_id?: string;
          id?: string;
          locacao_id?: string;
          lote_id?: string | null;
          motivo_cancelamento?: string | null;
          motivo_reabertura?: string | null;
          prazo?: string | null;
          prioridade?: Database["public"]["Enums"]["prioridade"];
          quantidade?: number | null;
          reaberta_em?: string | null;
          reaberta_por?: string | null;
          recebimento_id?: string | null;
          resolucao?: string | null;
          resolvida_em?: string | null;
          resolvida_por?: string | null;
          responsavel_id?: string | null;
          resultado?: Database["public"]["Enums"]["resultado_ocorrencia"] | null;
          status?: Database["public"]["Enums"]["status_ocorrencia"];
          status_anterior_bem?: Database["public"]["Enums"]["status_bem"] | null;
          tipo?: Database["public"]["Enums"]["tipo_ocorrencia"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ocorrencias_empresa_id_bem_id_fkey";
            columns: ["empresa_id", "bem_id"];
            isOneToOne: false;
            referencedRelation: "bens";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "ocorrencias_empresa_id_bem_substituto_id_fkey";
            columns: ["empresa_id", "bem_substituto_id"];
            isOneToOne: false;
            referencedRelation: "bens";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "ocorrencias_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ocorrencias_empresa_id_locacao_id_fkey";
            columns: ["empresa_id", "locacao_id"];
            isOneToOne: false;
            referencedRelation: "locacoes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "ocorrencias_empresa_id_locacao_id_fkey";
            columns: ["empresa_id", "locacao_id"];
            isOneToOne: false;
            referencedRelation: "v_saldo_locacao";
            referencedColumns: ["empresa_id", "locacao_id"];
          },
          {
            foreignKeyName: "ocorrencias_empresa_id_lote_id_fkey";
            columns: ["empresa_id", "lote_id"];
            isOneToOne: false;
            referencedRelation: "lotes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "ocorrencias_empresa_id_recebimento_id_fkey";
            columns: ["empresa_id", "recebimento_id"];
            isOneToOne: false;
            referencedRelation: "recebimentos";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "ocorrencias_empresa_id_responsavel_id_fkey";
            columns: ["empresa_id", "responsavel_id"];
            isOneToOne: false;
            referencedRelation: "usuarios_empresa";
            referencedColumns: ["empresa_id", "user_id"];
          },
        ];
      };
      perfis_usuario: {
        Row: {
          created_at: string;
          created_by: string | null;
          nome: string;
          telefone: string | null;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          nome: string;
          telefone?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          nome?: string;
          telefone?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      perguntas_checklist: {
        Row: {
          created_at: string;
          created_by: string | null;
          empresa_id: string;
          exige_foto_se: NonNullable<Json>;
          id: string;
          modelo_id: string;
          obrigatoria: boolean;
          opcoes: Json | null;
          ordem: number;
          texto: string;
          tipo_resposta: Database["public"]["Enums"]["tipo_resposta"];
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          empresa_id: string;
          exige_foto_se?: NonNullable<Json>;
          id?: string;
          modelo_id: string;
          obrigatoria?: boolean;
          opcoes?: Json | null;
          ordem: number;
          texto: string;
          tipo_resposta: Database["public"]["Enums"]["tipo_resposta"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          empresa_id?: string;
          exige_foto_se?: NonNullable<Json>;
          id?: string;
          modelo_id?: string;
          obrigatoria?: boolean;
          opcoes?: Json | null;
          ordem?: number;
          texto?: string;
          tipo_resposta?: Database["public"]["Enums"]["tipo_resposta"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "perguntas_checklist_empresa_id_modelo_id_fkey";
            columns: ["empresa_id", "modelo_id"];
            isOneToOne: false;
            referencedRelation: "modelos_checklist";
            referencedColumns: ["empresa_id", "id"];
          },
        ];
      };
      recebimentos: {
        Row: {
          cancelado_em: string | null;
          cancelado_por: string | null;
          codigo: string;
          confirmado_em: string | null;
          confirmado_por: string | null;
          created_at: string;
          created_by: string | null;
          data_evento: string | null;
          empresa_id: string;
          excesso_autorizado_em: string | null;
          excesso_autorizado_por: string | null;
          excesso_justificativa: string | null;
          id: string;
          locacao_id: string;
          local_id: string | null;
          motivo_cancelamento: string | null;
          observacoes: string | null;
          recebido_por: string | null;
          responsavel_id: string | null;
          status: Database["public"]["Enums"]["status_recebimento"];
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          cancelado_em?: string | null;
          cancelado_por?: string | null;
          codigo: string;
          confirmado_em?: string | null;
          confirmado_por?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_evento?: string | null;
          empresa_id: string;
          excesso_autorizado_em?: string | null;
          excesso_autorizado_por?: string | null;
          excesso_justificativa?: string | null;
          id?: string;
          locacao_id: string;
          local_id?: string | null;
          motivo_cancelamento?: string | null;
          observacoes?: string | null;
          recebido_por?: string | null;
          responsavel_id?: string | null;
          status?: Database["public"]["Enums"]["status_recebimento"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          cancelado_em?: string | null;
          cancelado_por?: string | null;
          codigo?: string;
          confirmado_em?: string | null;
          confirmado_por?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_evento?: string | null;
          empresa_id?: string;
          excesso_autorizado_em?: string | null;
          excesso_autorizado_por?: string | null;
          excesso_justificativa?: string | null;
          id?: string;
          locacao_id?: string;
          local_id?: string | null;
          motivo_cancelamento?: string | null;
          observacoes?: string | null;
          recebido_por?: string | null;
          responsavel_id?: string | null;
          status?: Database["public"]["Enums"]["status_recebimento"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recebimentos_empresa_id_excesso_autorizado_por_fkey";
            columns: ["empresa_id", "excesso_autorizado_por"];
            isOneToOne: false;
            referencedRelation: "usuarios_empresa";
            referencedColumns: ["empresa_id", "user_id"];
          },
          {
            foreignKeyName: "recebimentos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recebimentos_empresa_id_locacao_id_fkey";
            columns: ["empresa_id", "locacao_id"];
            isOneToOne: false;
            referencedRelation: "locacoes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "recebimentos_empresa_id_locacao_id_fkey";
            columns: ["empresa_id", "locacao_id"];
            isOneToOne: false;
            referencedRelation: "v_saldo_locacao";
            referencedColumns: ["empresa_id", "locacao_id"];
          },
          {
            foreignKeyName: "recebimentos_empresa_id_local_id_fkey";
            columns: ["empresa_id", "local_id"];
            isOneToOne: false;
            referencedRelation: "locais";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "recebimentos_empresa_id_recebido_por_fkey";
            columns: ["empresa_id", "recebido_por"];
            isOneToOne: false;
            referencedRelation: "usuarios_empresa";
            referencedColumns: ["empresa_id", "user_id"];
          },
          {
            foreignKeyName: "recebimentos_empresa_id_responsavel_id_fkey";
            columns: ["empresa_id", "responsavel_id"];
            isOneToOne: false;
            referencedRelation: "usuarios_empresa";
            referencedColumns: ["empresa_id", "user_id"];
          },
        ];
      };
      referencias_externas: {
        Row: {
          created_at: string;
          created_by: string | null;
          data_documento: string | null;
          empresa_id: string;
          id: string;
          locacao_id: string;
          numero: string;
          observacao: string | null;
          sistema: Database["public"]["Enums"]["sistema_externo"];
          tipo: Database["public"]["Enums"]["tipo_referencia"];
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          data_documento?: string | null;
          empresa_id: string;
          id?: string;
          locacao_id: string;
          numero: string;
          observacao?: string | null;
          sistema?: Database["public"]["Enums"]["sistema_externo"];
          tipo: Database["public"]["Enums"]["tipo_referencia"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          data_documento?: string | null;
          empresa_id?: string;
          id?: string;
          locacao_id?: string;
          numero?: string;
          observacao?: string | null;
          sistema?: Database["public"]["Enums"]["sistema_externo"];
          tipo?: Database["public"]["Enums"]["tipo_referencia"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "referencias_externas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referencias_externas_empresa_id_locacao_id_fkey";
            columns: ["empresa_id", "locacao_id"];
            isOneToOne: false;
            referencedRelation: "locacoes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "referencias_externas_empresa_id_locacao_id_fkey";
            columns: ["empresa_id", "locacao_id"];
            isOneToOne: false;
            referencedRelation: "v_saldo_locacao";
            referencedColumns: ["empresa_id", "locacao_id"];
          },
        ];
      };
      relatorios: {
        Row: {
          assinatura_hmac: string | null;
          codigo: string;
          concluido_em: string | null;
          created_at: string;
          created_by: string | null;
          empresa_id: string;
          erro: string | null;
          hash_arquivo: string | null;
          hash_dados: string | null;
          id: string;
          iniciado_em: string | null;
          parametros: NonNullable<Json>;
          solicitado_por: string;
          status: Database["public"]["Enums"]["status_relatorio"];
          storage_path: string | null;
          tentativas: number;
          tipo: Database["public"]["Enums"]["tipo_relatorio"];
          updated_at: string;
          updated_by: string | null;
          versao_template: string;
        };
        ComputedFields: never;
        Insert: {
          assinatura_hmac?: string | null;
          codigo: string;
          concluido_em?: string | null;
          created_at?: string;
          created_by?: string | null;
          empresa_id: string;
          erro?: string | null;
          hash_arquivo?: string | null;
          hash_dados?: string | null;
          id?: string;
          iniciado_em?: string | null;
          parametros: NonNullable<Json>;
          solicitado_por: string;
          status?: Database["public"]["Enums"]["status_relatorio"];
          storage_path?: string | null;
          tentativas?: number;
          tipo: Database["public"]["Enums"]["tipo_relatorio"];
          updated_at?: string;
          updated_by?: string | null;
          versao_template: string;
        };
        Update: {
          assinatura_hmac?: string | null;
          codigo?: string;
          concluido_em?: string | null;
          created_at?: string;
          created_by?: string | null;
          empresa_id?: string;
          erro?: string | null;
          hash_arquivo?: string | null;
          hash_dados?: string | null;
          id?: string;
          iniciado_em?: string | null;
          parametros?: NonNullable<Json>;
          solicitado_por?: string;
          status?: Database["public"]["Enums"]["status_relatorio"];
          storage_path?: string | null;
          tentativas?: number;
          tipo?: Database["public"]["Enums"]["tipo_relatorio"];
          updated_at?: string;
          updated_by?: string | null;
          versao_template?: string;
        };
        Relationships: [
          {
            foreignKeyName: "relatorios_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "relatorios_empresa_id_solicitado_por_fkey";
            columns: ["empresa_id", "solicitado_por"];
            isOneToOne: false;
            referencedRelation: "usuarios_empresa";
            referencedColumns: ["empresa_id", "user_id"];
          },
        ];
      };
      respostas_vistoria: {
        Row: {
          created_at: string;
          created_by: string | null;
          empresa_id: string;
          id: string;
          observacao: string | null;
          pergunta_id: string;
          resposta_json: NonNullable<Json>;
          updated_at: string;
          updated_by: string | null;
          vistoria_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          empresa_id: string;
          id?: string;
          observacao?: string | null;
          pergunta_id: string;
          resposta_json: NonNullable<Json>;
          updated_at?: string;
          updated_by?: string | null;
          vistoria_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          empresa_id?: string;
          id?: string;
          observacao?: string | null;
          pergunta_id?: string;
          resposta_json?: NonNullable<Json>;
          updated_at?: string;
          updated_by?: string | null;
          vistoria_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "respostas_vistoria_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "respostas_vistoria_empresa_id_pergunta_id_fkey";
            columns: ["empresa_id", "pergunta_id"];
            isOneToOne: false;
            referencedRelation: "perguntas_checklist";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "respostas_vistoria_empresa_id_vistoria_id_fkey";
            columns: ["empresa_id", "vistoria_id"];
            isOneToOne: false;
            referencedRelation: "vistorias";
            referencedColumns: ["empresa_id", "id"];
          },
        ];
      };
      usuarios_empresa: {
        Row: {
          ativo: boolean;
          created_at: string;
          created_by: string | null;
          empresa_id: string;
          id: string;
          papel: Database["public"]["Enums"]["papel_usuario"];
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          created_at?: string;
          created_by?: string | null;
          empresa_id: string;
          id?: string;
          papel: Database["public"]["Enums"]["papel_usuario"];
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          created_by?: string | null;
          empresa_id?: string;
          id?: string;
          papel?: Database["public"]["Enums"]["papel_usuario"];
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usuarios_empresa_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usuarios_empresa_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "perfis_usuario";
            referencedColumns: ["user_id"];
          },
        ];
      };
      vistorias: {
        Row: {
          bem_id: string | null;
          cancelada_em: string | null;
          concluida_em: string | null;
          created_at: string;
          created_by: string | null;
          data_evento: string;
          empresa_id: string;
          evento_origem_id: string | null;
          evento_origem_tipo: Database["public"]["Enums"]["entidade_evidencia"] | null;
          id: string;
          lote_id: string | null;
          modelo_id: string;
          observacao: string | null;
          realizada_por: string;
          status: Database["public"]["Enums"]["status_vistoria"];
          tipo: Database["public"]["Enums"]["tipo_vistoria"];
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          bem_id?: string | null;
          cancelada_em?: string | null;
          concluida_em?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_evento: string;
          empresa_id: string;
          evento_origem_id?: string | null;
          evento_origem_tipo?: Database["public"]["Enums"]["entidade_evidencia"] | null;
          id?: string;
          lote_id?: string | null;
          modelo_id: string;
          observacao?: string | null;
          realizada_por?: string;
          status?: Database["public"]["Enums"]["status_vistoria"];
          tipo: Database["public"]["Enums"]["tipo_vistoria"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          bem_id?: string | null;
          cancelada_em?: string | null;
          concluida_em?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_evento?: string;
          empresa_id?: string;
          evento_origem_id?: string | null;
          evento_origem_tipo?: Database["public"]["Enums"]["entidade_evidencia"] | null;
          id?: string;
          lote_id?: string | null;
          modelo_id?: string;
          observacao?: string | null;
          realizada_por?: string;
          status?: Database["public"]["Enums"]["status_vistoria"];
          tipo?: Database["public"]["Enums"]["tipo_vistoria"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "vistorias_empresa_id_bem_id_fkey";
            columns: ["empresa_id", "bem_id"];
            isOneToOne: false;
            referencedRelation: "bens";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "vistorias_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vistorias_empresa_id_lote_id_fkey";
            columns: ["empresa_id", "lote_id"];
            isOneToOne: false;
            referencedRelation: "lotes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "vistorias_empresa_id_modelo_id_fkey";
            columns: ["empresa_id", "modelo_id"];
            isOneToOne: false;
            referencedRelation: "modelos_checklist";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "vistorias_empresa_id_realizada_por_fkey";
            columns: ["empresa_id", "realizada_por"];
            isOneToOne: false;
            referencedRelation: "usuarios_empresa";
            referencedColumns: ["empresa_id", "user_id"];
          },
        ];
      };
    };
    Views: {
      v_saldo_item_locacao: {
        Row: {
          empresa_id: string | null;
          item_locacao_id: string | null;
          locacao_id: string | null;
          modo_controle: Database["public"]["Enums"]["modo_controle"] | null;
          quantidade_contratada: number | null;
          quantidade_devolvida: number | null;
          quantidade_recebida: number | null;
          saldo: number | null;
          unidade: string | null;
        };
        ComputedFields: never;
        Insert: {
          empresa_id?: string | null;
          item_locacao_id?: string | null;
          locacao_id?: string | null;
          modo_controle?: Database["public"]["Enums"]["modo_controle"] | null;
          quantidade_contratada?: number | null;
          quantidade_devolvida?: never;
          quantidade_recebida?: never;
          saldo?: never;
          unidade?: string | null;
        };
        Update: {
          empresa_id?: string | null;
          item_locacao_id?: string | null;
          locacao_id?: string | null;
          modo_controle?: Database["public"]["Enums"]["modo_controle"] | null;
          quantidade_contratada?: number | null;
          quantidade_devolvida?: never;
          quantidade_recebida?: never;
          saldo?: never;
          unidade?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "itens_locacao_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "itens_locacao_empresa_id_locacao_id_fkey";
            columns: ["empresa_id", "locacao_id"];
            isOneToOne: false;
            referencedRelation: "locacoes";
            referencedColumns: ["empresa_id", "id"];
          },
          {
            foreignKeyName: "itens_locacao_empresa_id_locacao_id_fkey";
            columns: ["empresa_id", "locacao_id"];
            isOneToOne: false;
            referencedRelation: "v_saldo_locacao";
            referencedColumns: ["empresa_id", "locacao_id"];
          },
        ];
      };
      v_saldo_locacao: {
        Row: {
          a_receber: number | null;
          bens_ativos: number | null;
          empresa_id: string | null;
          locacao_id: string | null;
          saldo_lotes: number | null;
          saldo_total: number | null;
          status: Database["public"]["Enums"]["status_locacao"] | null;
          status_financeiro: Database["public"]["Enums"]["status_financeiro"] | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "locacoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      consumir_limite_taxa: { Args: { p_acao: string }; Returns: boolean };
      status_bem_ativo: {
        Args: { p_status: Database["public"]["Enums"]["status_bem"] };
        Returns: boolean;
      };
      usuario_pertence_empresa: { Args: { empresa_uuid: string }; Returns: boolean };
    };
    Enums: {
      condicao_item: "NOVO" | "BOM" | "REGULAR" | "AVARIADO";
      entidade_evidencia:
        | "LOCACAO"
        | "RECEBIMENTO"
        | "ITEM_RECEBIMENTO"
        | "BEM"
        | "LOTE"
        | "VISTORIA"
        | "RESPOSTA_VISTORIA"
        | "MOVIMENTACAO"
        | "OCORRENCIA"
        | "DEVOLUCAO"
        | "COBRANCA";
      modo_controle: "INDIVIDUAL" | "LOTE";
      papel_usuario:
        | "ADMIN"
        | "COMPRAS"
        | "OPERACAO"
        | "RESPONSAVEL_LOCAL"
        | "FINANCEIRO"
        | "GESTOR"
        | "AUDITOR";
      periodicidade: "DIARIA" | "SEMANAL" | "QUINZENAL" | "MENSAL";
      prioridade: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
      resultado_ocorrencia: "ENCONTRADO" | "INDENIZADO" | "REPARADO" | "SUBSTITUIDO" | "OUTRO";
      sistema_externo: "SECTRA" | "OUTRO";
      status_bem:
        | "AGUARDANDO_RECEBIMENTO"
        | "DISPONIVEL"
        | "EM_USO"
        | "EM_TRANSFERENCIA"
        | "EM_MANUTENCAO"
        | "DEVOLUCAO_SOLICITADA"
        | "DEVOLVIDO"
        | "EXTRAVIADO"
        | "SUBSTITUIDO"
        | "BAIXADO"
        | "CANCELADO";
      status_checklist: "RASCUNHO" | "PUBLICADO" | "ARQUIVADO";
      status_cobranca: "PENDENTE" | "CONFERIDA" | "DIVERGENTE" | "RESOLVIDA";
      status_devolucao:
        "RASCUNHO" | "SOLICITADA" | "AGENDADA" | "RETIRADA_CONFIRMADA" | "CONFERIDA" | "CANCELADA";
      status_evidencia: "ATIVA" | "SUBSTITUIDA" | "REMOVIDA";
      status_financeiro: "NAO_INICIADO" | "EM_COBRANCA" | "ENCERRAMENTO_PENDENTE" | "ENCERRADO";
      status_locacao:
        "RASCUNHO" | "ATIVA" | "EM_DEVOLUCAO" | "ENCERRADA_OPERACIONALMENTE" | "CANCELADA";
      status_lote: "ATIVO" | "ENCERRADO" | "CANCELADO";
      status_movimentacao: "PENDENTE_ACEITE" | "CONFIRMADA" | "RECUSADA" | "CANCELADA";
      status_ocorrencia: "ABERTA" | "EM_TRATAMENTO" | "RESOLVIDA" | "CANCELADA";
      status_recebimento: "RASCUNHO" | "AGUARDANDO_AUTORIZACAO" | "CONFIRMADO" | "CANCELADO";
      status_relatorio: "PENDENTE" | "PROCESSANDO" | "CONCLUIDO" | "ERRO";
      status_vistoria: "RASCUNHO" | "CONCLUIDA" | "CANCELADA";
      tipo_evidencia: "FOTO" | "DOCUMENTO" | "COMPROVANTE" | "CONTRATO";
      tipo_local: "OBRA" | "ALMOXARIFADO" | "ESCRITORIO" | "OUTRO";
      tipo_ocorrencia:
        | "AVARIA"
        | "DEFEITO"
        | "EXTRAVIO"
        | "TROCA"
        | "DIVERGENCIA_QUANTIDADE"
        | "DIVERGENCIA_DOCUMENTAL"
        | "OUTRO";
      tipo_referencia:
        "PEDIDO" | "REQUISICAO" | "SOLICITACAO" | "CONTRATO" | "NOTA_FISCAL" | "OUTRO";
      tipo_relatorio: "LOCACAO" | "BEM" | "LOCAL" | "PERIODO";
      tipo_resposta: "SIM_NAO" | "CONFORME_NAO_CONFORME" | "OPCAO_UNICA" | "TEXTO" | "NUMERO";
      tipo_vistoria: "ENTRADA" | "PERIODICA" | "SAIDA" | "OCORRENCIA";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      condicao_item: ["NOVO", "BOM", "REGULAR", "AVARIADO"],
      entidade_evidencia: [
        "LOCACAO",
        "RECEBIMENTO",
        "ITEM_RECEBIMENTO",
        "BEM",
        "LOTE",
        "VISTORIA",
        "RESPOSTA_VISTORIA",
        "MOVIMENTACAO",
        "OCORRENCIA",
        "DEVOLUCAO",
        "COBRANCA",
      ],
      modo_controle: ["INDIVIDUAL", "LOTE"],
      papel_usuario: [
        "ADMIN",
        "COMPRAS",
        "OPERACAO",
        "RESPONSAVEL_LOCAL",
        "FINANCEIRO",
        "GESTOR",
        "AUDITOR",
      ],
      periodicidade: ["DIARIA", "SEMANAL", "QUINZENAL", "MENSAL"],
      prioridade: ["BAIXA", "MEDIA", "ALTA", "CRITICA"],
      resultado_ocorrencia: ["ENCONTRADO", "INDENIZADO", "REPARADO", "SUBSTITUIDO", "OUTRO"],
      sistema_externo: ["SECTRA", "OUTRO"],
      status_bem: [
        "AGUARDANDO_RECEBIMENTO",
        "DISPONIVEL",
        "EM_USO",
        "EM_TRANSFERENCIA",
        "EM_MANUTENCAO",
        "DEVOLUCAO_SOLICITADA",
        "DEVOLVIDO",
        "EXTRAVIADO",
        "SUBSTITUIDO",
        "BAIXADO",
        "CANCELADO",
      ],
      status_checklist: ["RASCUNHO", "PUBLICADO", "ARQUIVADO"],
      status_cobranca: ["PENDENTE", "CONFERIDA", "DIVERGENTE", "RESOLVIDA"],
      status_devolucao: [
        "RASCUNHO",
        "SOLICITADA",
        "AGENDADA",
        "RETIRADA_CONFIRMADA",
        "CONFERIDA",
        "CANCELADA",
      ],
      status_evidencia: ["ATIVA", "SUBSTITUIDA", "REMOVIDA"],
      status_financeiro: ["NAO_INICIADO", "EM_COBRANCA", "ENCERRAMENTO_PENDENTE", "ENCERRADO"],
      status_locacao: [
        "RASCUNHO",
        "ATIVA",
        "EM_DEVOLUCAO",
        "ENCERRADA_OPERACIONALMENTE",
        "CANCELADA",
      ],
      status_lote: ["ATIVO", "ENCERRADO", "CANCELADO"],
      status_movimentacao: ["PENDENTE_ACEITE", "CONFIRMADA", "RECUSADA", "CANCELADA"],
      status_ocorrencia: ["ABERTA", "EM_TRATAMENTO", "RESOLVIDA", "CANCELADA"],
      status_recebimento: ["RASCUNHO", "AGUARDANDO_AUTORIZACAO", "CONFIRMADO", "CANCELADO"],
      status_relatorio: ["PENDENTE", "PROCESSANDO", "CONCLUIDO", "ERRO"],
      status_vistoria: ["RASCUNHO", "CONCLUIDA", "CANCELADA"],
      tipo_evidencia: ["FOTO", "DOCUMENTO", "COMPROVANTE", "CONTRATO"],
      tipo_local: ["OBRA", "ALMOXARIFADO", "ESCRITORIO", "OUTRO"],
      tipo_ocorrencia: [
        "AVARIA",
        "DEFEITO",
        "EXTRAVIO",
        "TROCA",
        "DIVERGENCIA_QUANTIDADE",
        "DIVERGENCIA_DOCUMENTAL",
        "OUTRO",
      ],
      tipo_referencia: ["PEDIDO", "REQUISICAO", "SOLICITACAO", "CONTRATO", "NOTA_FISCAL", "OUTRO"],
      tipo_relatorio: ["LOCACAO", "BEM", "LOCAL", "PERIODO"],
      tipo_resposta: ["SIM_NAO", "CONFORME_NAO_CONFORME", "OPCAO_UNICA", "TEXTO", "NUMERO"],
      tipo_vistoria: ["ENTRADA", "PERIODICA", "SAIDA", "OCORRENCIA"],
    },
  },
} as const;
