# == Schema Info
#
# Table name: viewings
#
#  id         :integer         not null, primary key
#  user_id    :integer
#  topic_id   :integer
#  created_at :datetime
#  updated_at :datetime

class Viewing < ActiveRecord::Base
  
  attr_accessible :topic_id, :user_id
  
  belongs_to :user
  
  validates_presence_of :user_id, :topic_id
  validates_uniqueness_of :user_id, :scope => :topic_id
  
  def to_s
    id.to_s
  end
  
end
